'use client';

// お気に入りを地図に並べる（Leaflet + OpenStreetMap）
// Google の地図APIは課金対象のため、無料の OpenStreetMap タイルを使う。
// Leaflet は npm 依存を増やさないよう CDN から読み込む。

import React, { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../lib/swipick';
import GoogleMapView from './GoogleMapView';

export type MapItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sub?: string;
  href: string;
  emoji?: string; // ピンに表示するタグのアイコン
  image?: string; // 吹き出しに出す、最初の写真
};

const LEAFLET_VERSION = '1.9.4';

/* eslint-disable @typescript-eslint/no-explicit-any */
let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const base = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;
    if (!document.querySelector('link[data-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${base}/leaflet.css`;
      css.setAttribute('data-leaflet', 'true');
      document.head.appendChild(css);
    }
    const s = document.createElement('script');
    s.src = `${base}/leaflet.js`;
    s.async = true;
    s.onload = () => (w.L ? resolve(w.L) : reject(new Error('leaflet_missing')));
    s.onerror = () => {
      leafletPromise = null;
      reject(new Error('leaflet_load_failed'));
    };
    document.head.appendChild(s);
  });
  return leafletPromise;
}

function LeafletMap({
  items,
  userPos,
  onOpenDetails,
  height = 380,
}: {
  items: MapItem[];
  userPos: LatLng | null;
  onOpenDetails?: (id: string) => void;
  height?: number | string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // 地図の初期化（1回だけ）
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const map = L.map(elRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        map.setView([34.7025, 135.4959], 13); // 初期表示：梅田付近
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setStatus('ready');
        setTimeout(() => map.invalidateSize(), 50);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // マーカーの更新
  useEffect(() => {
    if (status !== 'ready') return;
    const L = (window as any).L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    const bounds: [number, number][] = [];

    for (const it of items) {
      const marker = it.emoji
        ? L.marker([it.lat, it.lng], {
            title: it.name,
            icon: L.divIcon({
              className: '',
              html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:17px;line-height:1"></span></div>',
              iconSize: [34, 34],
              iconAnchor: [4, 34],
              popupAnchor: [13, -30],
            }),
          })
        : L.circleMarker([it.lat, it.lng], {
            radius: 9,
            color: '#ffffff',
            weight: 2,
            fillColor: '#ef4444',
            fillOpacity: 0.95,
          });
      if (it.emoji) {
        // 絵文字は textContent で入れる（外部入力を innerHTML に入れない）
        marker.once?.('add', () => {
          const span = marker.getElement?.()?.querySelector('span');
          if (span) span.textContent = it.emoji as string;
        });
      }

      // 店名は外部データなので innerHTML は使わず DOM で組み立てる
      const box = document.createElement('div');
      box.style.width = `${Math.round(Math.min(280, window.innerWidth * 0.65, Math.max(180, it.name.length * 15 + 20)))}px`;
      if (it.image && /^(\/|https?:)/.test(it.image)) {
        const img = document.createElement('img');
        img.src = it.image;
        img.alt = it.name;
        img.loading = 'lazy';
        img.style.cssText = 'display:block;width:0;min-width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px;background:#eee';
        img.addEventListener('error', () => img.remove());
        box.appendChild(img);
      }
      const title = document.createElement('div');
      title.textContent = it.name;
      title.style.fontWeight = '700';
      title.style.overflowWrap = 'anywhere';
      title.style.marginBottom = '4px';
      box.appendChild(title);
      if (it.sub) {
        const sub = document.createElement('div');
        sub.textContent = it.sub;
        sub.style.fontSize = '12px';
        sub.style.color = '#555';
        sub.style.marginBottom = '6px';
        box.appendChild(sub);
      }
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '10px';
      if (onOpenDetails) {
        const d = document.createElement('a');
        d.textContent = '詳細';
        d.href = '#';
        d.addEventListener('click', (e) => {
          e.preventDefault();
          onOpenDetails(it.id);
        });
        row.appendChild(d);
      }
      const g = document.createElement('a');
      g.textContent = 'Googleマップ';
      g.href = it.href;
      g.target = '_blank';
      g.rel = 'noreferrer';
      row.appendChild(g);
      box.appendChild(row);

      marker.bindPopup(box);
      marker.addTo(layer);
      bounds.push([it.lat, it.lng]);
    }

    if (userPos) {
      L.circleMarker([userPos.lat, userPos.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 1,
      })
        .bindPopup('現在地')
        .addTo(layer);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    } else if (userPos) {
      map.setView([userPos.lat, userPos.lng], 15);
    }
  }, [items, userPos, status, onOpenDetails]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={elRef}
        style={{
          width: '100%',
          height,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--chip)',
          boxShadow: '0 4px 12px var(--elev)',
        }}
      />
      {status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 16,
          }}
        >
          {status === 'loading' ? '地図を読み込み中…' : '地図を読み込めませんでした。通信状況を確認してください。'}
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          位置情報のあるお気に入りがありません。
        </div>
      )}
    </div>
  );
}

/** Googleマップ（キーがあれば）→ だめなら OpenStreetMap にフォールバック */
export default function FavoritesMap(props: {
  items: MapItem[];
  userPos: LatLng | null;
  onOpenDetails?: (id: string) => void;
  height?: number | string;
}) {
  const [failed, setFailed] = useState(false);
  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!hasKey || failed) return <LeafletMap {...props} />;
  return <GoogleMapView {...props} onFail={() => setFailed(true)} />;
}
