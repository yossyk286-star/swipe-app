
'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

type SharedCard = { name: string; image: string };

// Base64 UTF-8 デコード
function fromBase64Utf8(b64: string) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return '[]';
  }
}

export default function SharePage() {
  const sp = useSearchParams();
  const payload = sp.get('f') || '';

  const items: SharedCard[] = useMemo(() => {
    try {
      const json = fromBase64Utf8(payload);
      const arr = JSON.parse(json);
      if (Array.isArray(arr)) {
        return arr.filter((x) => x && typeof x.name === 'string' && typeof x.image === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }, [payload]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>共有リスト</h1>
      <p style={{ color:'#555', marginTop: -8 }}>受け取ったお気に入りをまとめて表示</p>

      {items.length === 0 ? (
        <div style={{
          width: 360, maxWidth:'90vw', padding: 16, borderRadius: 12,
          background:'#fff', boxShadow:'0 10px 30px rgba(0,0,0,0.08)', color:'#555'
        }}>
          共有データが読み取れませんでした。
          送信者にもう一度リンクを作り直してもらってください。
        </div>
      ) : (
        <ul style={{
          width: 360, maxWidth:'90vw',
          listStyle:'none', padding:0, margin:0,
          display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10,
        }}>
          {items.map((f, idx) => (
            <li key={`${f.name}-${idx}`} style={{
              borderRadius: 10, overflow:'hidden', background:'#fff',
              boxShadow:'0 4px 12px rgba(0,0,0,0.06)',
            }}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name)}`}
                target="_blank" rel="noreferrer"
                style={{ color:'inherit', textDecoration:'none', display:'block' }}
              >
                <img src={f.image} alt={f.name} loading="lazy" style={{ width:'100%', height: 120, objectFit:'cover' }} />
                <div style={{ padding: 10, fontSize: 13, fontWeight: 700 }}>{f.name}</div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
