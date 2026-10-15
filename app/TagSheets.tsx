'use client';

import React, { useState } from 'react';
import { TAG_ICON_CHOICES } from './lib/swipick';

/** ------------ 共通スタイル ------------ */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 5000,
};

const sheetStyle: React.CSSProperties = {
  width: 'min(100vw, 520px)',
  maxHeight: '80vh',
  overflow: 'auto',
  background: 'var(--card)',
  color: 'var(--text)',
  borderRadius: '16px 16px 0 0',
  padding: 16,
  paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
  boxShadow: '0 -10px 30px var(--elev)',
  boxSizing: 'border-box',
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 999,
  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--card)',
  color: active ? 'var(--bg)' : 'var(--text)',
  fontSize: 14,
  fontWeight: 700,
});

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '10px 12px',
  fontSize: 16, // iOS Safari で入力時にズームされないよう 16px
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: disabled ? 'var(--chip)' : 'var(--primary)',
  color: disabled ? 'var(--text-muted)' : 'var(--bg)',
  fontWeight: 700,
});

const subBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 13,
};

/** 日本語IMEの変換確定のEnterで送信されないようにする */
function isEnterToSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
  return e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229;
}

/** ------------ お店のタグ編集シート（チップをタップでON/OFF） ------------ */
export function TagSheet({
  title,
  allTags,
  icons = {},
  activeTags,
  onToggle,
  onCreate,
  onClose,
}: {
  title: string;
  allTags: string[];
  icons?: Record<string, string>;
  activeTags: string[];
  onToggle: (tag: string) => void;
  onCreate: (tag: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const name = draft.trim();
  const canCreate = name !== '' && !activeTags.includes(name);

  const submit = () => {
    if (!canCreate) return;
    onCreate(name); // 新規 or 既存タグを、このお店に付ける
    setDraft('');
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>タグを選ぶ</div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          </div>
          <button onClick={onClose} style={primaryBtn(false)}>
            完了
          </button>
        </div>

        {/* 入力欄は上に置く（キーボードで隠れにくい） */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (isEnterToSubmit(e)) submit();
            }}
            placeholder="新しいタグ名（例：海鮮 / ワイン）"
            style={inputStyle}
          />
          <button onClick={submit} disabled={!canCreate} style={primaryBtn(!canCreate)}>
            追加
          </button>
        </div>

        {allTags.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            まだタグがありません。上の欄から作ってください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => onToggle(t)}
                aria-pressed={activeTags.includes(t)}
                style={chipStyle(activeTags.includes(t))}
              >
                {activeTags.includes(t) ? '✓ ' : ''}
                {icons[t] ? `${icons[t]} ` : ''}
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** ------------ タグ管理（名前変更・削除） ------------ */
export function TagManager({
  tags,
  counts,
  icons = {},
  onIcon,
  onRename,
  onDelete,
  onClose,
}: {
  tags: string[];
  counts: Record<string, number>;
  icons?: Record<string, string>;
  onIcon?: (tag: string, icon: string | null) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (tag: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pickingIcon, setPickingIcon] = useState<string | null>(null);

  const startEdit = (t: string) => {
    setEditing(t);
    setDraft(t);
  };
  const saveEdit = () => {
    if (editing == null) return;
    const n = draft.trim();
    if (n && n !== editing) onRename(editing, n);
    setEditing(null);
  };
  const confirmDelete = (t: string) => {
    const n = counts[t] ?? 0;
    const msg =
      n > 0
        ? `タグ「${t}」を削除します。${n}件のお店から外れます。よろしいですか？`
        : `タグ「${t}」を削除します。よろしいですか？`;
    if (window.confirm(msg)) onDelete(t);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>タグの管理</div>
          <button onClick={onClose} style={primaryBtn(false)}>
            閉じる
          </button>
        </div>

        {tags.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>タグがありません。</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {tags.map((t) => (
              <div
                key={t}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onIcon && (
                  <button
                    onClick={() => setPickingIcon((cur) => (cur === t ? null : t))}
                    aria-label={`${t} のアイコンを変える`}
                    aria-expanded={pickingIcon === t}
                    style={{
                      flex: '0 0 auto', width: 40, height: 40, borderRadius: 20, fontSize: 20, padding: 0,
                      border: pickingIcon === t ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: 'var(--chip)', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {icons[t] ?? '🏷️'}
                  </button>
                )}
                {editing === t ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (isEnterToSubmit(e)) saveEdit();
                      }}
                      style={inputStyle}
                    />
                    <button onClick={saveEdit} style={primaryBtn(draft.trim() === '')}>
                      保存
                    </button>
                    <button onClick={() => setEditing(null)} style={subBtn}>
                      戻す
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700 }}>{t}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        {counts[t] ?? 0}件
                      </span>
                    </div>
                    <button onClick={() => startEdit(t)} style={subBtn}>
                      名前変更
                    </button>
                    <button onClick={() => confirmDelete(t)} style={subBtn}>
                      削除
                    </button>
                  </>
                )}
              </div>
              {onIcon && pickingIcon === t && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                    {TAG_ICON_CHOICES.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => { onIcon(t, ic); setPickingIcon(null); }}
                        aria-label={`アイコン ${ic}`}
                        style={{
                          aspectRatio: '1 / 1', fontSize: 20, padding: 0, borderRadius: 8,
                          border: icons[t] === ic ? '2px solid var(--accent)' : '1px solid transparent',
                          background: icons[t] === ic ? 'var(--accent-bg)' : 'transparent',
                        }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { onIcon(t, null); setPickingIcon(null); }} style={{ ...subBtn, marginTop: 8 }}>
                    アイコンをもとに戻す
                  </button>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
