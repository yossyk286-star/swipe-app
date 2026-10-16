'use client';

// 設定画面：テーマ・アクセントカラー・データ（バックアップ／見送り履歴）
import React, { useEffect, useRef, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

/** スワイプまわりの設定 */
export type Prefs = {
  showNoPhoto: boolean; // 写真のないお店も出す
  leftHanded: boolean;  // ボタンの並びを左右反転（左手用）
  haptics: boolean;     // スワイプ時の振動
  likeText: string;     // 右スワイプのスタンプ文言
  nopeText: string;     // 左スワイプのスタンプ文言
  customLike?: string;  // 保存しておいた自分用の文言（右）
  customNope?: string;  // 保存しておいた自分用の文言（左）
};
export const DEFAULT_PREFS: Prefs = { showNoPhoto: false, leftHanded: false, haptics: true, likeText: 'LIKE', nopeText: 'NOPE' };

/** スタンプ文言のプリセット */
const STAMP_PRESETS: [string, string][] = [
  ['LIKE', 'NOPE'],
  ['GOOD', 'BAD'],
  ['ええやん', 'ちゃうな〜'],
  ['行く！', 'またね'],
];

export const ACCENTS = [
  // to / toDark：グラデーションのもう片方の色（ボタンや選んだタブに使う）
  { id: 'blue', name: 'ブルー', light: '#1a73e8', dark: '#8ab4f8', to: '#7c4dff', toDark: '#b39dff' },
  { id: 'green', name: 'グリーン', light: '#188038', dark: '#81c995', to: '#12b5a4', toDark: '#7fe0d3' },
  { id: 'orange', name: 'オレンジ', light: '#e8710a', dark: '#fcad70', to: '#f43f5e', toDark: '#ff9bb0' },
  { id: 'pink', name: 'ピンク', light: '#d01884', dark: '#ff8bcb', to: '#f97316', toDark: '#ffb27a' },
  { id: 'purple', name: 'パープル', light: '#8430ce', dark: '#d7aefb', to: '#3b82f6', toDark: '#9cc2ff' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];

const section: React.CSSProperties = {
  marginTop: 16, padding: 18, borderRadius: 22, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  boxShadow: '0 2px 10px color-mix(in srgb, var(--elev) 50%, transparent)',
};
const heading: React.CSSProperties = {
  fontWeight: 800, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
  borderLeft: '4px solid var(--accent)', paddingLeft: 10, lineHeight: 1.2,
};
const hint: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 8 };

const pill = (active: boolean): React.CSSProperties => ({
  flex: '1 1 auto', minWidth: 0, padding: '11px 4px', borderRadius: 14, fontSize: 12.5, whiteSpace: 'nowrap', fontWeight: active ? 700 : 500,
  border: 'none',
  background: active ? 'var(--accent-bg)' : 'var(--chip)',
  color: active ? 'var(--accent)' : 'var(--text)',
});
const textInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 16, fontWeight: 800,
  border: '2px solid var(--border)', background: 'var(--card)',
};
const action: React.CSSProperties = {
  padding: '11px 16px', borderRadius: 999, border: 'none',
  background: 'var(--chip)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
};

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div className="jp-text" style={{ ...hint, marginTop: 4 }}>{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{
          flex: '0 0 auto', width: 52, height: 32, borderRadius: 16, border: 'none', padding: 3, position: 'relative',
          background: on ? 'var(--accent)' : 'var(--chip)', transition: 'background .15s',
        }}
      >
        <span
          style={{
            display: 'block', width: 26, height: 26, borderRadius: 13, background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.35)', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .15s',
          }}
        />
      </button>
    </div>
  );
}

export default function SettingsView({
  theme, onTheme, accent, onAccent, prefs, onPrefs, favoritesCount, seenCount, onExport, onImport, onResetSeen, onShowGuide,
}: {
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
  accent: AccentId;
  onAccent: (a: AccentId) => void;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  favoritesCount: number;
  seenCount: number;
  onExport: () => void;
  onImport: (file: File) => void;
  onResetSeen: () => void;
  onShowGuide?: () => void;
}) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [canVibrate, setCanVibrate] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanVibrate(typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'); }, []);

  return (
    <div>
      <h1 style={{ margin: '4px 2px 4px', fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>設定</h1>

      <section style={section}>
        <div style={heading}>テーマ</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']] as [ThemeMode, string][]).map(([k, label]) => (
            <button key={k} onClick={() => onTheme(k)} style={pill(theme === k)} aria-pressed={theme === k}>{label}</button>
          ))}
        </div>
        <div style={hint}>「端末に合わせる」は、スマホのライト／ダーク設定に自動で切り替わります。</div>

        <div style={{ ...heading, marginTop: 18 }}>テーマカラー</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {ACCENTS.map((a) => {
            const active = accent === a.id;
            return (
              <button
                key={a.id}
                onClick={() => onAccent(a.id)}
                aria-label={a.name}
                aria-pressed={active}
                style={{
                  width: 44, height: 44, borderRadius: 22, padding: 0, background: `linear-gradient(135deg, ${a.light}, ${a.to})`,
                  border: active ? '3px solid var(--text)' : '3px solid transparent',
                  boxShadow: active ? '0 0 0 2px var(--card) inset' : 'none',
                }}
              />
            );
          })}
        </div>
        <div style={hint}>選択中：{ACCENTS.find((a) => a.id === accent)?.name}</div>
      </section>

      <section style={section}>
        <div style={heading}>スワイプ</div>

        <ToggleRow
          label="写真のないお店も出す"
          desc="オフのときは、写真のないお店を出しません。変更は次の検索から反映されます。"
          on={prefs.showNoPhoto}
          onChange={(v) => onPrefs({ ...prefs, showNoPhoto: v })}
        />

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

        <div style={{ fontSize: 14, fontWeight: 600 }}>ボタンの位置</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => onPrefs({ ...prefs, leftHanded: false })} style={pill(!prefs.leftHanded)} aria-pressed={!prefs.leftHanded}>右手用</button>
          <button onClick={() => onPrefs({ ...prefs, leftHanded: true })} style={pill(prefs.leftHanded)} aria-pressed={prefs.leftHanded}>左手用</button>
        </div>
        <div style={hint}>
          右手用は「✕」が左、「♥」が右です。左手用は左右を入れ替えます。
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

        <div style={{ fontSize: 14, fontWeight: 600 }}>スワイプの文言</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {STAMP_PRESETS.map(([l, n]) => {
            const active = prefs.likeText === l && prefs.nopeText === n;
            return (
              <button
                key={l}
                onClick={() => onPrefs({ ...prefs, likeText: l, nopeText: n })}
                aria-pressed={active}
                style={{ ...pill(active), flex: '0 0 auto', padding: '8px 12px' }}
              >
                <span style={{ color: '#10b981', fontWeight: 800 }}>{l}</span>
                <span style={{ color: 'var(--text-muted)' }}> / </span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>{n}</span>
              </button>
            );
          })}
          {prefs.customLike && prefs.customNope && (() => {
            const l = prefs.customLike, n = prefs.customNope;
            const active = prefs.likeText === l && prefs.nopeText === n;
            return (
              <button
                onClick={() => onPrefs({ ...prefs, likeText: l, nopeText: n })}
                aria-pressed={active}
                style={{ ...pill(active), flex: '0 0 auto', padding: '8px 12px' }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>★マイ文言 </span>
                <span style={{ color: '#10b981', fontWeight: 800 }}>{l}</span>
                <span style={{ color: 'var(--text-muted)' }}> / </span>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>{n}</span>
              </button>
            );
          })()}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <label style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            右にスワイプ（保存）
            <input
              value={prefs.likeText}
              maxLength={10}
              onChange={(e) => onPrefs({ ...prefs, likeText: e.target.value })}
              style={{ ...textInput, borderColor: '#10b981', color: '#10b981' }}
            />
          </label>
          <label style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            左にスワイプ（見送り）
            <input
              value={prefs.nopeText}
              maxLength={10}
              onChange={(e) => onPrefs({ ...prefs, nopeText: e.target.value })}
              style={{ ...textInput, borderColor: '#ef4444', color: '#ef4444' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onPrefs({ ...prefs, customLike: prefs.likeText.trim() || 'LIKE', customNope: prefs.nopeText.trim() || 'NOPE' })}
            disabled={prefs.likeText.trim() === '' && prefs.nopeText.trim() === ''}
            style={action}
          >
            この文言を「マイ文言」に保存
          </button>
          {prefs.customLike && (
            <button onClick={() => onPrefs({ ...prefs, customLike: undefined, customNope: undefined })} style={action}>
              マイ文言を削除
            </button>
          )}
        </div>
        <div style={hint}>カードをスワイプしたときに出る文字です。自由に書き換えられます（10文字まで）。空にすると標準に戻ります。「マイ文言」は1つだけ保存でき、上のボタンからいつでも呼び出せます。</div>

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

        <ToggleRow
          label="振動（触覚）"
          desc={canVibrate ? 'スワイプしたときに、軽く振動します。' : 'この端末（iPhoneのSafariなど）は、ブラウザが振動に対応していないため、オンにしても動きません。'}
          on={prefs.haptics}
          onChange={(v) => onPrefs({ ...prefs, haptics: v })}
        />
      </section>

      {onShowGuide && (
        <section style={section}>
          <div style={heading}>使い方</div>
          <div style={{ ...hint, marginTop: 0, marginBottom: 12 }}>スワイプや検索の使い方を、動くデモでもう一度見られます。</div>
          <button onClick={onShowGuide} style={action}>使い方を見る</button>
        </section>
      )}

      <section style={section}>
        <div style={heading}>データ</div>
        <div style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
          お気に入りとタグは、この端末のブラウザ内だけに保存されています。機種変更やブラウザのデータ削除の前に書き出しておくと、別の端末で読み込めます。
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onExport} disabled={favoritesCount === 0} style={{ ...action, opacity: favoritesCount === 0 ? 0.5 : 1 }}>
            書き出す
          </button>
          <button onClick={() => importRef.current?.click()} style={action}>読み込む</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
          />
        </div>
        {seenCount > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={onResetSeen} style={action}>見送り履歴（{seenCount}件）をリセット</button>
            <div style={hint}>見送ったお店を、もう一度スワイプに出せるようにします。</div>
          </div>
        )}
      </section>
    </div>
  );
}
