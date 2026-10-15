/* eslint-disable @next/next/no-img-element */

// app/share/ShareClient.tsx
'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Favorite,
  STORAGE_KEYS,
  decodeShare,
  mapsDirectionsUrl,
  mapsPlaceUrl,
} from '../lib/swipick';

export default function ShareClient() {
  const sp = useSearchParams();
  const payload = sp.get('f') || '';
  const items = useMemo(() => decodeShare(payload), [payload]);
  const [result, setResult] = useState<string | null>(null);

  // 自分のお気に入りに取り込む（同じブラウザの localStorage に追加）
  function importAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.favorites);
      const current: Favorite[] = raw ? JSON.parse(raw) : [];
      const ids = new Set(current.map((f) => f.id));
      let added = 0;
      for (const it of items) {
        if (!it.placeId || ids.has(it.placeId)) continue;
        current.push({
          id: it.placeId,
          name: it.name,
          image: it.image ?? '',
          openNow: null,
          photosCount: 1,
          photoRefs: it.ref ? [it.ref] : [],
          currentIdx: 0,
          address: null,
          types: [],
          lat: it.lat ?? null,
          lng: it.lng ?? null,
          tags: [],
          addedAt: Date.now(),
        });
        ids.add(it.placeId);
        added++;
      }
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(current));
      setResult(added > 0 ? `${added}件をお気に入りに追加しました。` : '追加できる新しいお店はありませんでした（すでに登録済み）。');
    } catch {
      setResult('追加できませんでした。');
    }
  }

  const canImport = items.some((it) => !!it.placeId);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>共有リスト</h1>
      <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
        {items.length > 0 ? `${items.length}件のお店が届きました` : '受け取ったお気に入りをまとめて表示'}
      </p>

      {items.length === 0 ? (
        <div
          style={{
            width: 360,
            maxWidth: '90vw',
            padding: 16,
            borderRadius: 12,
            background: 'var(--card)',
            boxShadow: '0 10px 30px var(--elev)',
            color: 'var(--text-muted)',
          }}
        >
          共有データが読み取れませんでした。
          送信者にもう一度リンクを作り直してもらってください。
        </div>
      ) : (
        <>
          {canImport && (
            <div style={{ width: 360, maxWidth: '90vw', display: 'grid', gap: 6 }}>
              <button
                onClick={importAll}
                style={{
                  padding: '12px 14px', borderRadius: 10, border: 'none',
                  background: 'var(--primary)', color: 'var(--bg)', fontWeight: 700, fontSize: 15,
                }}
              >
                ♥ まとめて自分のお気に入りに追加
              </button>
              {result && (
                <div style={{ fontSize: 13, color: 'var(--text)', textAlign: 'center' }}>
                  {result} <a href="/" style={{ color: 'var(--accent)', fontWeight: 700 }}>Swipickを開く →</a>
                </div>
              )}
            </div>
          )}

          <ul
            style={{
              width: 360,
              maxWidth: '90vw',
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {items.map((f, idx) => (
              <li
                key={`${f.placeId ?? f.name}-${idx}`}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--card)',
                  boxShadow: '0 4px 12px var(--elev)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <a
                  href={mapsPlaceUrl(f.name, f.placeId)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                >
                  {f.image ? (
                    <img
                      src={f.image}
                      alt={f.name}
                      loading="lazy"
                      style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ height: 120, background: 'var(--chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍽</div>
                  )}
                  <div style={{ padding: '8px 10px 4px', fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                    {f.name}
                  </div>
                </a>
                <div style={{ display: 'flex', gap: 6, padding: '4px 10px 10px', marginTop: 'auto' }}>
                  <a
                    href={mapsDirectionsUrl(f.name, f.placeId)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', textDecoration: 'none' }}
                  >
                    🚶 経路
                  </a>
                  <a
                    href={mapsPlaceUrl(f.name, f.placeId)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', textDecoration: 'none' }}
                  >
                    🗺 地図
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
