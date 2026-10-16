'use client';
import React, { useEffect, useState } from 'react';

const KEY = 'onboarded_v1';

const ROWS: { icon: string; title: string; text: string }[] = [
  { icon: '🔍', title: '検索', text: '上の検索欄に、行きたいお店のキーワードを自由に入力してね（例：渋谷 ラーメン）' },
  { icon: '👈', title: '左にスワイプ', text: 'スキップ。気にならないお店は左へ' },
  { icon: '👉', title: '右にスワイプ', text: '保存。気になるお店は「保存済み」に入るよ' },
  { icon: '👆', title: '上にスワイプ', text: 'お店の詳細（住所・営業時間・写真など）を見る' },
];

/** 初回起動時だけ出す使い方の案内。設定の「使い方を見る」から再表示もできる */
export default function Onboarding({ reopenSignal = 0 }: { reopenSignal?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (reopenSignal > 0) setOpen(true);
  }, [reopenSignal]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* 保存できなくても閉じる */ }
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, maxHeight: '90dvh', overflowY: 'auto',
          background: 'var(--card)', color: 'var(--text)', borderRadius: 20, padding: '22px 20px 18px',
          boxShadow: '0 12px 40px rgba(0,0,0,.4)', border: '1px solid var(--border)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>Swipick の使い方</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
          カードをスワイプして、行きたいお店を集めよう
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {ROWS.map((r) => (
            <div key={r.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0, fontSize: 24,
                background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{r.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{r.text}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          style={{
            width: '100%', marginTop: 20, padding: '12px 0', border: 'none', borderRadius: 12,
            background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
          }}
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
