'use client';

// お気に入りを Google マップに並べる（Maps JavaScript API）
// キー未設定・認証エラー・読み込み失敗のときは onFail で OpenStreetMap に切り替える。

import React, { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../lib/swipick';
import type { MapItem } from './FavoritesMap';

/* eslint-disable @typescript-eslint/no-explicit-any */
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

let loadPromise: Promise<any> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

function loadGoogle(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (loadPromise) return loadPromise;
  w.gm_authFailure = () => {
    authFailed = true;
    authListeners.forEach((fn) => fn());
  };
  loadPromise = new Promise((resolve, reject) => {
    w.__gmapsReady = () => resolve(w.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&language=ja&region=JP&callback=__gmapsReady`;
    s.async = true;
    s.onerror = () => {
      loadPromise = null;
      reject(new Error('gmaps_load_failed'));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export default function GoogleMapView({
  items,
  userPos,
  onOpenDetails,
  onFail,
  height = 380,
}: {
  items: MapItem[];
  userPos: LatLng | null;
  onOpenDetails?: (id: string) => void;
  onFail: () => void;
  height?: number | string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const libsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fail = () => { if (!cancelled) onFail(); };
    authListeners.add(fail);
    if (authFailed) { fail(); return; }
    loadGoogle()
      .then(async (g) => {
        const { Map, InfoWindow } = await g.maps.importLibrary('maps');
        const marker = await g.maps.importLibrary('marker');
        if (cancelled || !elRef.current) return;
        const map = new Map(elRef.current, {
          center: { lat: 34.7025, lng: 135.4959 },
          zoom: 13,
          mapId: MAP_ID,
          colorScheme: 'FOLLOW_SYSTEM',
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        infoRef.current = new InfoWindow();
        libsRef.current = marker;
        setReady(true);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      authListeners.delete(fail);
      markersRef.current.forEach((m) => { m.map = null; });
      markersRef.current = [];
      infoRef.current?.close();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libsRef.current;
    const g = (window as any).google;
    if (!ready || !map || !lib || !g) return;

    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    const bounds = new g.maps.LatLngBounds();

    const openInfo = (it: MapItem, m: any) => {
      // 店名は外部データなので DOM で組み立てる
      const box = document.createElement('div');
      box.style.minWidth = '160px';
      box.style.color = '#222';
      const title = document.createElement('div');
      title.textContent = it.name;
      title.style.fontWeight = '700';
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
      row.style.gap = '12px';
      if (onOpenDetails) {
        const d = document.createElement('a');
        d.textContent = '詳細';
        d.href = '#';
        d.addEventListener('click', (e) => { e.preventDefault(); onOpenDetails(it.id); });
        row.appendChild(d);
      }
      const gl = document.createElement('a');
      gl.textContent = 'Googleマップ';
      gl.href = it.href;
      gl.target = '_blank';
      gl.rel = 'noreferrer';
      row.appendChild(gl);
      box.appendChild(row);
      infoRef.current.setContent(box);
      infoRef.current.open({ map, anchor: m });
    };

    for (const it of items) {
      const pin = new lib.PinElement({ background: '#ea4335', borderColor: '#b31412', glyphColor: '#fff' });
      const m = new lib.AdvancedMarkerElement({
        map,
        position: { lat: it.lat, lng: it.lng },
        title: it.name,
        content: pin.element ?? pin,
      });
      let last = 0;
      const handler = () => {
        const now = Date.now();
        if (now - last < 300) return;
        last = now;
        openInfo(it, m);
      };
      m.addListener('gmp-click', handler);
      m.addListener('click', handler);
      markersRef.current.push(m);
      bounds.extend({ lat: it.lat, lng: it.lng });
    }

    if (userPos) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#4285f4;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.4)';
      const m = new lib.AdvancedMarkerElement({
        map,
        position: { lat: userPos.lat, lng: userPos.lng },
        title: '現在地',
        content: dot,
      });
      markersRef.current.push(m);
      if (items.length === 0) {
        map.setCenter({ lat: userPos.lat, lng: userPos.lng });
        map.setZoom(15);
      }
    }

    if (items.length > 0) {
      map.fitBounds(bounds, 40);
      g.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
      });
    }
  }, [items, userPos, ready, onOpenDetails]);
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
      {!ready && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}
        >
          地図を読み込み中…
        </div>
      )}
      {ready && items.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          位置情報のあるお気に入りがありません。
        </div>
      )}
    </div>
  );
}
