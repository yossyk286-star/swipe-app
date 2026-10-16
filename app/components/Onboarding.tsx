'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icons';

const KEY = 'onboarded_v1';

type Step = {
  kind: 'search' | 'left' | 'right' | 'up';
  title: string;
  text: string;
};

const STEPS: Step[] = [
  { kind: 'search', title: '自由に検索', text: '上の検索欄にキーワードを入れてね（例：渋谷 ラーメン）' },
  { kind: 'right', title: '右にスワイプ＝保存', text: '気になるお店は右へ。「保存済み」に入るよ' },
  { kind: 'left', title: '左にスワイプ＝スキップ', text: '気にならないお店は左へ。次のお店が出るよ' },
  { kind: 'up', title: '上にスワイプ＝詳細', text: '住所・営業時間・写真などを見られるよ' },
];

const STEP_MS = 3800;

/** デモ用の疑似カード。指の動きに合わせてカードが動く */
function DemoCard({ kind }: { kind: 'left' | 'right' | 'up' }) {
  const dx = kind === 'right' ? 90 : kind === 'left' ? -90 : 0;
  const dy = kind === 'up' ? -90 : 0;
  const rot = kind === 'right' ? 12 : kind === 'left' ? -12 : 0;
  const stamp = kind === 'right' ? { t: '保存', c: '#16a34a' } : kind === 'left' ? { t: 'スキップ', c: '#e11d48' } : { t: '詳細', c: '#2563eb' };
  const times = [0, 0.25, 0.65, 0.85, 1];
  const ease = 'easeInOut' as const;
  const loop = { duration: 2.4, times, ease, repeat: Infinity, repeatDelay: 0.3 };
  return (
    <div style={{ position: 'relative', width: 200, height: 250 }}>
      {/* 後ろのカード */}
      <div style={{ position: 'absolute', inset: 0, transform: 'scale(.94) translateY(10px)', borderRadius: 20, background: '#d1d5db' }} />
      <motion.div
        animate={{ x: [0, 0, dx, dx, 0], y: [0, 0, dy, dy, 0], rotate: [0, 0, rot, rot, 0] }}
        transition={loop}
        style={{
          position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden',
          background: 'linear-gradient(160deg,#fde68a,#fb923c)', boxShadow: '0 10px 28px rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        <div style={{ position: 'absolute', top: 62, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: .9 }}>
          <Icon name="pin" size={72} color="rgba(255,255,255,.92)" />
        </div>
        <div style={{ width: '100%', padding: '10px 12px', background: 'linear-gradient(transparent,rgba(0,0,0,.6))', color: '#fff', fontWeight: 800, fontSize: 15 }}>
          サンプル食堂
        </div>
        <motion.div
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={loop}
          style={{
            position: 'absolute', top: 18, [kind === 'left' ? 'right' : 'left']: 14,
            border: `3px solid ${stamp.c}`, color: stamp.c, borderRadius: 8, padding: '2px 10px',
            fontWeight: 900, fontSize: 22, letterSpacing: 2, background: 'rgba(255,255,255,.85)',
            transform: `rotate(${kind === 'left' ? 12 : -12}deg)`,
          }}
        >
          {stamp.t}
        </motion.div>
      </motion.div>
      {/* タッチの丸（指の代わり） */}
      <motion.div
        animate={{ x: [0, 0, dx, dx, 0], y: [0, 0, dy, dy, 0], opacity: [0, 1, 1, 0, 0] }}
        transition={loop}
        style={{ position: 'absolute', left: 78, top: 160, width: 44, height: 44, pointerEvents: 'none' }}
      >
        <motion.div
          animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,.7)' }}
        />
        <div style={{
          position: 'absolute', inset: 6, borderRadius: '50%', background: 'rgba(255,255,255,.95)',
          boxShadow: '0 2px 10px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.6)',
        }} />
      </motion.div>
    </div>
  );
}

/** 検索のデモ：検索欄に文字が打ち込まれる */
function DemoSearch() {
  const full = '渋谷 ラーメン';
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= full.length + 4 ? 0 : v + 1)), 260);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ width: 250, height: 250, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: '#fff', color: '#222', borderRadius: 14,
        padding: '12px 14px', fontSize: 16, boxShadow: '0 6px 20px rgba(0,0,0,.3)',
      }}>
        <span style={{ color: '#6b7280', display: 'flex' }}><Icon name="search" size={20} /></span>
        <span>{full.slice(0, Math.min(n, full.length))}<span style={{ opacity: n % 2 ? 0 : 1 }}>|</span></span>
      </div>
      <motion.div
        animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ display: 'flex', justifyContent: 'center' }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </motion.div>
      <div style={{ textAlign: 'center', color: '#fff', fontSize: 13, opacity: .85 }}>お店のカードが出てくるよ</div>
    </div>
  );
}

/** 初回起動時だけ出す、動くデモ付きの使い方案内（Tinder風） */
export default function Onboarding({ reopenSignal = 0 }: { reopenSignal?: number }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const touchRef = React.useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (reopenSignal > 0) { setI(0); setOpen(true); }
  }, [reopenSignal]);

  // 一定時間ごとに次のステップへ（最後は止める）
  useEffect(() => {
    if (!open || i >= STEPS.length - 1) return;
    const t = setTimeout(() => setI((v) => v + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [open, i]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* 保存できなくても閉じる */ }
  };

  const go = (d: number) => setI((v) => Math.max(0, Math.min(STEPS.length - 1, v + d)));
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    // 左にスワイプ→次へ／右にスワイプ→前へ
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
  };

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(8,10,16,.92)', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '20px 24px', gap: 18, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      <button
        type="button"
        onClick={close}
        style={{
          position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', right: 16, background: 'transparent',
          border: '1px solid rgba(255,255,255,.5)', color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
        }}
      >
        スキップ
      </button>

      <div key={step.kind} style={{ height: 270, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {step.kind === 'search' ? <DemoSearch /> : <DemoCard kind={step.kind} />}
      </div>

      <motion.div key={`t-${step.kind}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ textAlign: 'center', maxWidth: 320, minHeight: 78 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{step.title}</div>
        <div style={{ fontSize: 14, opacity: .85, lineHeight: 1.6, marginTop: 6 }}>{step.text}</div>
      </motion.div>

      <div style={{ display: 'flex', gap: 8 }}>
        {STEPS.map((s, k) => (
          <button
            key={s.kind}
            type="button"
            aria-label={`${k + 1}つ目`}
            onClick={() => setI(k)}
            style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, border: 'none', padding: 0, cursor: 'pointer', background: k === i ? '#fff' : 'rgba(255,255,255,.4)', transition: 'width .2s' }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => (last ? close() : setI(i + 1))}
        style={{
          minWidth: 200, padding: '12px 0', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 16, cursor: 'pointer',
          background: last ? 'var(--accent-grad, var(--accent, #1a73e8))' : '#fff', color: last ? '#fff' : '#111',
        }}
      >
        {last ? 'はじめる' : '次へ'}
      </button>
    </div>
  );
}
