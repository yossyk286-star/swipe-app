'use client';

// 設定画面：テーマ・アクセントカラー・データ（バックアップ／見送り履歴）
import React, { useRef } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

export const ACCENTS = [
  { id: 'blue', name: 'ブルー', light: '#1a73e8', dark: '#8ab4f8' },
  { id: 'green', name: 'グリーン', light: '#188038', dark: '#81c995' },
  { id: 'orange', name: 'オレンジ', light: '#e8710a', dark: '#fcad70' },
  { id: 'pink', name: 'ピンク', light: '#d01884', dark: '#ff8bcb' },
  { id: 'purple', name: 'パープル', light: '#8430ce', dark: '#d7aefb' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];

const section: React.CSSProperties = {
  marginTop: 16, padding: 16, borderRadius: 14, boxSizing: 'border-box',
  background: 'var(--card)', boxShadow: '0 1px 4px var(--elev)',
};
const heading: React.CSSProperties = { fontWeight: 600, fontSize: 15, marginBottom: 10 };
const hint: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 8 };

const pill = (active: boolean): React.CSSProperties => ({
  flex: '1 1 0', minWidth: 0, padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 500,
  border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--accent-bg)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text)',
});
const action: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text)', fontSize: 13,
};

export default function SettingsView({
  theme, onTheme, accent, onAccent, favoritesCount, seenCount, onExport, onImport, onResetSeen,
}: {
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
  accent: AccentId;
  onAccent: (a: AccentId) => void;
  favoritesCount: number;
  seenCount: number;
  onExport: () => void;
  onImport: (file: File) => void;
  onResetSeen: () => void;
}) {
  const importRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <h1 style={{ margin: '4px 2px 4px', fontSize: 24, fontWeight: 600 }}>設定</h1>

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
                  width: 44, height: 44, borderRadius: 22, padding: 0, background: a.light,
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
