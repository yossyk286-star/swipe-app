'use client';

// 設定画面：テーマ・アクセントカラー・データ（バックアップ／見送り履歴）
import React, { useEffect, useRef, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

/** スワイプまわりの設定 */
export type Prefs = {
  showNoPhoto: boolean; // 写真のないお店も出す
  leftHanded: boolean;  // ボタンの並びを左右反転（左手用）
  haptics: boolean;     // スワイプ時の振動
};
export const DEFAULT_PREFS: Prefs = { showNoPhoto: false, leftHanded: false, haptics: true };

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
  theme, onTheme, accent, onAccent, prefs, onPrefs, favoritesCount, seenCount, onExport, onImport, onResetSeen,
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
}) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [canVibrate, setCanVibrate] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanVibrate(typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'); }, []);

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

        <ToggleRow
          label="振動（触覚）"
          desc={canVibrate ? 'スワイプしたときに、軽く振動します。' : 'この端末（iPhoneのSafariなど）は、ブラウザが振動に対応していないため、オンにしても動きません。'}
          on={prefs.haptics}
          onChange={(v) => onPrefs({ ...prefs, haptics: v })}
        />
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
