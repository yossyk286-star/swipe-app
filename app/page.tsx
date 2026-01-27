/* eslint-disable @next/next/no-img-element */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';

/** ------------ 型 ------------ */
type PlaceCard = {
  id: string;
  name: string;
  image: string;          // /api/photo?ref=...
  openNow: boolean | null;
  photosCount: number;
  photoRefs: string[];    // 画像切替用
  currentIdx?: number;    // 今表示中の photoRefs インデックス
  address?: string | null;
  types: string[];
  lat: number | null;
  lng: number | null;
};

type PlaceDetails = {
  name: string | null;
  address: string | null;
  website: string | null;
  mapUrl: string | null;
  phone: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openingHours: any | null; // { open_now, periods, weekday_text }
  types: string[];
  rating: number | null;
  userRatingsTotal: number;
  priceLevel: number | null;
  photoRefs: string[];
  lat: number | null;
  lng: number | null;
};

type Favorite = PlaceCard & { tags: string[] };

/** ------------ 定数 ------------ */
const SWIPE_THRESHOLD = 120;
const VISIBLE_STACK = 3;
const CARD_IMG_SIZE = 96;

/** ------------ 画像URLヘルパー（再発防止） ------------ */
const photoUrl = (ref: string, max = 1200) =>
  `/api/photo?${new URLSearchParams({ ref, maxwidth: String(max) }).toString()}`;

const getRefFromImageUrl = (u: string) => {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(u, base);
    return url.searchParams.get('ref') ?? '';
  } catch {
    return '';
  }
};

/** ------------ 永続化（Hydration-safe 版） ------------ */
/**
 * 初回レンダーは `initial` を使い、マウント後に localStorage を反映。
 * → SSR とクライアント初回を一致させ、Hydration mismatch を防ぐ。
 */
function usePersistentArray<T>(key: string, initial: T[]) {
  const [value, setValue] = useState<T[]>(initial); // 初回は initial（SSR と一致）

  // マウント後に localStorage を反映
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setValue(JSON.parse(raw) as T[]);
    } catch {}
  }, [key]);

  // 値が変わったら保存
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

/** ------------ 距離 ------------ */
function haversineMeters(a: {lat:number, lng:number}, b:{lat:number, lng:number}) {
  const R = 6371e3, toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const s = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function formatDistance(m: number | null | undefined) {
  if (m == null) return '-';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m/1000).toFixed(1)}km`;
}

/** ------------ 画像アニメ（フェード／スライド） ------------ */
function AnimatedImage({
  src,
  alt,
  onClick,
  variant = 'slide', // 'fade' | 'slide'
  style,
  className,
}: {
  src: string;
  alt: string;
  onClick?: () => void;
  variant?: 'fade' | 'slide';
  style?: React.CSSProperties;
  className?: string;
}) {
  const [keySrc, setKeySrc] = useState(src);
  useEffect(() => { setKeySrc(src); }, [src]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={keySrc}
          src={keySrc}
          alt={alt}
          onClick={onClick}
          className={className}
          style={{ ...style, position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: onClick ? 'pointer' : 'default' }}
          initial={variant === 'fade' ? { opacity: 0 } : { x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={variant === 'fade' ? { opacity: 0 } : { x: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </AnimatePresence>
    </div>
  );
}

/** ------------ 詳細モーダル ------------ */
function DetailsModal({
  open, onClose, placeId,
}: {open:boolean; onClose:()=>void; placeId:string}) {
  const [loading, setLoading] = useState(false);
  const [d, setD] = useState<PlaceDetails | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/details?placeId=${encodeURIComponent(placeId)}`, { cache:'no-store' });
        const detailJson = await r.json();
        setD(detailJson.details ?? null);
      } catch {
        setD(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, placeId]);

  const todayText = (() => {
    if (!d?.openingHours?.weekday_text) return null;
    const days = d.openingHours.weekday_text as string[];
    const i = new Date().getDay(); // 0=日
    const wd = ['日','月','火','水','木','金','土'][i];
    const hit = days.find(s => s.startsWith(wd));
    return hit ?? days[i] ?? null;
  })();

  if (!open) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000
    }} onClick={onClose}>
      <div
        style={{ width:'min(92vw, 520px)', maxHeight:'90vh', overflow:'auto', background:'var(--card)', color:'var(--text)', borderRadius:12, padding:14, position:'relative', boxShadow:'0 10px 30px var(--elev)' }}
        onClick={(e)=>e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position:'absolute', top:8, right:10, background:'transparent', border:'none', fontSize:20, color:'var(--text)' }}>×</button>

        {loading && <div>読み込み中…</div>}
        {!loading && d && (
          <>
            <h2 style={{ margin:'8px 0 4px' }}>{d.name}</h2>
            <div style={{ color:'var(--text-muted)', fontSize:14 }}>{d.address}</div>
            <div style={{ display:'grid', gap:8, marginTop:12 }}>
              {todayText && <div><b>今日の営業時間</b><br/>{todayText}</div>}
              <div><b>評価</b>：{d.rating ?? '-'}（{d.userRatingsTotal}件）</div>
              {d.phone && <div><b>電話</b>：<a href={`tel:${d.phone}`} style={{ color:'var(--text)' }}>{d.phone}</a></div>}
              {d.website && (
                <div><b>公式サイト</b>：
                  <a href={d.website} target="_blank" rel="noreferrer" style={{ color:'var(--text)', wordBreak:'break-all', textDecoration:'underline' }}>
                    {d.website}
                  </a>
                </div>
              )}
              {d.mapUrl && (
                <div><b>Googleマップ</b>：
                  <a href={d.mapUrl} target="_blank" rel="noreferrer" style={{ color:'var(--text)', textDecoration:'underline' }}>
                    {d.mapUrl}
                  </a>
                </div>
              )}
            </div>
            {d.photoRefs?.length > 0 && (
              <>
                <div style={{ marginTop:14, fontWeight:700 }}>写真</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                  {d.photoRefs.slice(0,6).map((ref, i) => (
                    <img key={i} src={photoUrl(ref, 800)} alt={`ph-${i}`} style={{ width:'100%', height:120, objectFit:'cover', borderRadius:6 }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {!loading && !d && <div>情報を取得できませんでした。</div>}
      </div>
    </div>
  );
}

/** ------------ 距離表示 ------------ */
function CardDistance({ lat, lng }:{lat:number|null; lng:number|null}) {
  const [pos, setPos] = useState<{lat:number; lng:number} | null>(null);
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      ()=>{},
      { enableHighAccuracy:false, timeout: 5000 }
    );
  }, []);
  const dist = useMemo(() => {
    if (!pos || lat==null || lng==null) return null;
    return haversineMeters(pos, { lat, lng });
  }, [pos, lat, lng]);
  return <div>📏 {formatDistance(dist)}</div>;
}

/** ------------ 検索側：先頭カード（B+C対応） ------------ */
function SwipeableCard({
  card,
  onSwiped,
  onSwipeUp,
  onTapImage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eager = false,
}: {
  card: PlaceCard;
  onSwiped: (dir: 'left' | 'right') => void;
  onSwipeUp: () => void;
  onTapImage: () => void; // 画像切替
  eager?: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -40], [1, 0]);

  // 画像エリア開始の上フリックのみ詳細（強め判定）
  const startRef = useRef<{x:number; y:number; t:number; inImage:boolean} | null>(null);

  // 画像エリアの参照（スクロール抑止）
  const imgAreaRef = useRef<HTMLDivElement | null>(null);

  const ANGLE_RATIO = 1.7;  // |dy| >= |dx|*1.7 で縦意図
  const MIN_DIST = 100;     // 上方向に100px以上
  const MIN_VEL = 0.7;      // 速度（px/ms）

  // ネイティブの touchmove を passive:false でフック（ブラウザ差異対策の保険）
  useEffect(() => {
    const el = imgAreaRef.current;
    if (!el) return;

    const onTouchMoveNative = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };

    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMoveNative);
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    const inImage = !!target.closest('[data-image-area="true"]');
    startRef.current = { x: t.clientX, y: t.clientY, t: performance.now(), inImage };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const end = e.changedTouches[0];
    const dt = Math.max(1, performance.now() - startRef.current.t);
    const dx = end.clientX - startRef.current.x;
    const dy = end.clientY - startRef.current.y;
    const vy = Math.abs(dy) / dt; // px/ms
    const verticalIntent = Math.abs(dy) >= Math.abs(dx) * ANGLE_RATIO;
    const strongUp = dy < -MIN_DIST && vy >= MIN_VEL;
    if (startRef.current.inImage && verticalIntent && strongUp) onSwipeUp();
    startRef.current = null;
  };

  return (
    <motion.div
      style={{
        position:'absolute', inset:0, borderRadius:16, overflow:'hidden',
        background:'var(--card)', color:'var(--text)', boxShadow:'0 10px 30px var(--elev)',
        x, rotate,
        // 画像外は縦スクロールを許可
        touchAction:'pan-y',
        zIndex:1000
      }}
      drag="x" dragElastic={0.2} dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        const ox = info.offset.x;
        if (ox > SWIPE_THRESHOLD) onSwiped('right');
        else if (ox < -SWIPE_THRESHOLD) onSwiped('left');
        else x.set(0);
      }}
      initial={{ opacity:0, scale:0.95 }}
      animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0, scale:0.95 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* 営業中バッジ */}
      <div style={{
        position:'absolute', top:8, right:8, padding:'4px 10px',
        borderRadius:999, background: card.openNow ? 'rgba(16,185,129,0.9)' : 'rgba(107,114,128,0.9)',
        color:'#fff', fontSize:12, fontWeight:700, zIndex:5,
      }}>
        {card.openNow ? '営業中' : '営業時間外'}
      </div>

      {/* LIKE/NOPE */}
      <motion.div style={{
        position:'absolute', top:16, left:16, padding:'6px 10px',
        borderRadius:8, background:'rgba(16,185,129,0.9)', color:'#fff',
        fontWeight:700, opacity:likeOpacity, pointerEvents:'none', zIndex:5
      }}>LIKE</motion.div>
      <motion.div style={{
        position:'absolute', top:16, right:16, padding:'6px 10px',
        borderRadius:8, background:'rgba(239,68,68,0.9)', color:'#fff',
        fontWeight:700, opacity:nopeOpacity, pointerEvents:'none', zIndex:5
      }}>NOPE</motion.div>

      {/* 画像エリア（ここでの上フリックのみ詳細） */}
      <div
        ref={imgAreaRef}
        style={{
          position:'relative', width:'100%', height:'58%',
          touchAction:'none',                     // ← 画像上のスクロール/ズーム/パン抑止
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overscrollBehavior:'contain' as any,    // ← 親へのオーバースクロール伝播抑止
        }}
        data-image-area="true"
        aria-label="写真エリア（上にフリックで詳細、タップで写真切替）"
        // 合成イベント経由の保険（cancelable のときのみ）
        onTouchMove={(e) => {
          const ne = (e.nativeEvent as unknown as TouchEvent);
          if (ne?.cancelable) e.preventDefault();
        }}
      >
        <AnimatedImage
          src={card.image}
          alt={card.name}
          onClick={onTapImage}      // タップで写真切替
          variant="slide"
        />

        {/* 「詳細」ピルボタン（左上配置） */}
        <button
          onClick={onSwipeUp}
          title="詳細を開く"
          style={{
            position:'absolute', left:10, top:10, zIndex:6,
            padding:'6px 10px', borderRadius:999,
            background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:12
          }}
          aria-label="詳細を開く"
        >
          詳細
        </button>

        {/* タップヒント（右下の薄いピル） */}
        <div
          aria-hidden="true"
          className="tap-hint"
          style={{
            position:'absolute', right:10, bottom:10, zIndex:6,
            padding:'6px 10px', borderRadius:999,
            background:'rgba(0,0,0,0.45)', color:'#fff', fontSize:12,
            pointerEvents:'none', userSelect:'none'
          }}
        >
          タップで写真切替
        </div>

        {/* 下部ハンドル（↑ 詳細の視覚ヒント） */}
        <div
          aria-hidden="true"
          style={{
            position:'absolute',
            left:'50%', bottom:4, transform:'translateX(-50%)',
            zIndex:6,
            color:'rgba(255,255,255,0.55)',
            fontSize:12,
            textShadow:'0 1px 1px rgba(0,0,0,0.35)',
            pointerEvents:'none', userSelect:'none'
          }}
        >
          ↑ 詳細
        </div>
      </div>

      {/* 店名＋住所/時間/距離（ここはスクロール優先） */}
      <div style={{ padding:14 }}>
        <h2 style={{ margin:'0 0 6px', fontSize:18 }}>{card.name}</h2>
        <div style={{ color:'var(--text-muted)', fontSize:13, lineHeight:1.5 }}>
          {card.address && <div>📍 {card.address}</div>}
          <div>🕒 {card.openNow === null ? '時間情報なし' : (card.openNow ? '営業中' : '営業時間外')}（詳細は写真で上フリック）</div>
          <CardDistance lat={card.lat} lng={card.lng} />
        </div>
      </div>
    </motion.div>
  );
}

/** ------------ ページ本体（タブバーなし） ------------ */
export default function Home() {
  /** テーマ（Hydration-safe 版） */
  const [theme, setTheme] = useState<'light'|'dark'>('light'); // SSR と合わせて 'light' で開始
  // マウント後に localStorage から復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') setTheme(stored as 'light'|'dark');
    } catch {}
  }, []);
  // 反映
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('theme', theme); } catch {}
    }
  }, [theme]);

  // 検索
  const [q, setQ] = useState('梅田 居酒屋');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [deck, setDeck] = useState<PlaceCard[]>([]);
  const [favorites, setFavorites] = usePersistentArray<Favorite>('favorites_v8', []); // ← 初回は []（SSR と一致）

  // お気に入りフィルタ（タグ複数＋キーワード）
  const [favFilterText, setFavFilterText] = useState('');
  const [favFilterTags, setFavFilterTags] = useState<Set<string>>(new Set());

  // 詳細モーダル
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPlaceId, setDetailsPlaceId] = useState<string>('');

  // タグ（グローバル）
  const [userTags, setUserTags] = usePersistentArray<string>('user_tags_global', ['カフェ', '居酒屋', 'バー']);

  // 詳細の写真キャッシュ（画像補完）
  const detailsPhotosCacheRef = useRef<Record<string, string[]>>({});

  // お気に入りタブ：一覧 or タグ追加
  type FavTab = 'list' | 'tag-add';
  const [favTab, setFavTab] = useState<FavTab>('list');

  // タグ追加タブ：選択状態 & 入力欄（上部に配置・小型）
  const [selectedFavIds, setSelectedFavIds] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');

  // 一覧タブ：ヘッダー右「タグを追加」→ 検索バー下に小さな追加バーを出す
  const [showGlobalAddBar, setShowGlobalAddBar] = useState(false);
  const [globalTagInput, setGlobalTagInput] = useState('');

  const visible = useMemo(() => deck.slice(0, VISIBLE_STACK), [deck]);
  const top = visible[0];
  const visibleRest = useMemo(() => deck.slice(1, VISIBLE_STACK), [deck]);

  /** 検索 */
  async function searchCore(withGeo?: { lat: number; lng: number }) {
    try {
      setError(null); setLoading(true);
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const params = new URLSearchParams({ q });
      if (withGeo) { params.set('lat', String(withGeo.lat)); params.set('lng', String(withGeo.lng)); }
      const res = await fetch(`/api/places?${params.toString()}`, { cache:'no-store', signal: abortRef.current.signal });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resJson = await res.json() as { cards?: any[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = Array.isArray(resJson?.cards) ? (resJson.cards as any[]) : [];

      const items: PlaceCard[] = raw
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => !!p.photoRef)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any, idx: number): PlaceCard => ({
          id: p.placeId ?? `p-${idx}`,
          name: p.name ?? '名称不明',
          image: photoUrl(p.photoRef, 1200),
          openNow: p.openNow ?? null,
          photosCount: typeof p.photosCount === 'number' ? p.photosCount : 1,
          photoRefs: (p.photoRefs ?? []) as string[],
          currentIdx: 0,
          address: p.address ?? null,
          types: p.types ?? [],
          lat: p.lat ?? null,
          lng: p.lng ?? null,
        }))
        .sort((a, b) => b.photosCount - a.photosCount);

      setDeck(items.slice(0, 30));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError('検索に失敗しました。少し待ってから再実行してください。');
    } finally { setLoading(false); }
  }
  function tryGeolocateAndSearch() {
    if (!('geolocation' in navigator)) { searchCore(); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => searchCore({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => searchCore(),
      { enableHighAccuracy:false, timeout:5000 }
    );
  }
  useEffect(() => { tryGeolocateAndSearch(); }, []); // 初回のみ（マウント後）

  /** 画像切替（不足時は Details から補完） */
  async function nextPhotoWithFetch(placeId: string) {
    const card = deck.find(c => c.id === placeId);
    if (!card) return;

    let refs = card.photoRefs;
    if (!refs || refs.length <= 1) {
      const cached = detailsPhotosCacheRef.current[placeId];
      if (cached && cached.length) {
        refs = Array.from(new Set([...(refs||[]), ...cached]));
        setDeck(prev => prev.map(c => c.id === placeId ? ({ ...c, photoRefs: refs, photosCount: refs.length }) : c));
      } else {
        try {
          const r = await fetch(`/api/details?placeId=${encodeURIComponent(placeId)}`, { cache:'no-store' });
          const detailJson = await r.json();
          const extra: string[] = (detailJson.details?.photoRefs ?? []).filter(Boolean);
          detailsPhotosCacheRef.current[placeId] = extra;
          if (extra.length) {
            refs = Array.from(new Set([...(refs||[]), ...extra]));
            setDeck(prev => prev.map(c => c.id === placeId ? ({ ...c, photoRefs: refs, photosCount: refs.length }) : c));
          }
        } catch {}
      }
    }

    setDeck(prev => prev.map(c => {
      if (c.id !== placeId) return c;
      const total = c.photoRefs?.length || 1;
      const next = ((c.currentIdx ?? 0) + 1) % total;
      const ref = c.photoRefs[next] ?? getRefFromImageUrl(c.image);
      return { ...c, currentIdx: next, image: photoUrl(ref, 1200) };
    }));
  }

  /** お気に入り操作 */
  function addFavorite(c: PlaceCard) {
    setFavorites(prev => prev.some(p => p.id === c.id) ? prev : [...prev, { ...c, tags: [] }]);
  }
  function deleteFavorite(id: string) {
    setFavorites(prev => prev.filter(f => f.id !== id));
    setSelectedFavIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  /** 一覧：各カードの＋タグ → プロンプト（高さを増やさない） */
  function addSingleTagByPrompt(f: Favorite) {
    const candidates = Array.from(new Set([...userTags, ...favorites.flatMap(x => x.tags || [])]));
    const input = prompt(`追加するタグ名（既存: ${candidates.join(' / ') || 'なし'}）`, '');
    const t = (input || '').trim();
    if (!t) return;
    setFavorites(prev => prev.map(x => x.id === f.id ? { ...x, tags: Array.from(new Set([...(x.tags||[]), t])) } : x));
    if (!userTags.includes(t)) setUserTags(prev => [...prev, t]);
  }

  /** お気に入りフィルタ（ANY一致） */
  const filteredFavorites = useMemo(() => {
    const text = favFilterText.trim().toLowerCase();
    const tags = favFilterTags;
    return favorites.filter(f => {
      const okText = !text ||
        f.name.toLowerCase().includes(text) ||
        (f.address || '').toLowerCase().includes(text);
      const okTags = tags.size === 0 || [...tags].some(t => f.tags?.includes(t));
      return okText && okTags;
    });
  }, [favorites, favFilterText, favFilterTags]);

  /** タグ追加タブ：まとめて付与（上の小型バー） */
  const existingAllTags = useMemo(
    () => Array.from(new Set([...userTags, ...favorites.flatMap(f => f.tags || [])])),
    [userTags, favorites]
  );
  function applyTagToSelected() {
    const name = tagInput.trim();
    if (!name || selectedFavIds.size === 0) return;
    setFavorites(prev => prev.map(f => selectedFavIds.has(f.id)
      ? { ...f, tags: Array.from(new Set([...(f.tags || []), name])) }
      : f
    ));
    if (!userTags.includes(name)) setUserTags(prev => [...prev, name]);
    setTagInput('');
    setSelectedFavIds(new Set());
  }

  /** 一覧タブ：ヘッダー右「タグを追加」→ 検索バー下の小型バー */
  function applyGlobalTag() {
    const t = globalTagInput.trim();
    if (!t) return;
    if (userTags.includes(t)) {
      alert('既に存在するタグです');
    } else {
      setUserTags(prev => [...prev, t]);
    }
    setGlobalTagInput('');
    setShowGlobalAddBar(false);
  }

  /** テーマ用 CSS 変数（+ ヒントのフェードアウト） */
  const themeVars = `
    :root {
      --bg: #f5f7fb;
      --text: #111;
      --text-muted: #666;
      --card: #fff;
      --border: #ddd;
      --primary: #111;
      --chip: #f1f1f1;
      --elev: rgba(0,0,0,0.12);
    }
    [data-theme="dark"] {
      --bg: #0f1115;
      --text: #e8ecf1;
      --text-muted: #b6bdc7;
      --card: #171a20;
      --border: #2a2f3a;
      --primary: #e8ecf1;
      --chip: #252a34;
      --elev: rgba(0,0,0,0.42);
    }
    body { background: var(--bg); color: var(--text); }
    input, button { color: inherit; }

    /* 2秒後に2秒かけてフェードアウト（1回） */
    .tap-hint { animation: hintFade 2s ease 2s forwards; }
    @keyframes hintFade { to { opacity: 0; visibility: hidden; } }
  `;

  return (
    <main
      style={{
        minHeight:'100vh', background:'var(--bg)', color:'var(--text)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:20,
        position:'relative'
      }}
    >
      {/* テーマトグル（左上） */}
      <button
        onClick={()=> setTheme(t => t==='light' ? 'dark' : 'light')}
        title="テーマ切替"
        style={{
          position:'fixed', left:12, top:12, zIndex:6000,
          width:36, height:36, borderRadius:999,
          border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)'
        }}
      >
        {/* 初回の 🌙/🌞 のズレが気になる場合は suppressHydrationWarning を付ける */}
        <span suppressHydrationWarning>{theme === 'light' ? '🌙' : '🌞'}</span>
      </button>

      {/* タイトル：Swipick */}
      <h1 style={{ fontSize:22, fontWeight:700 }}>Swipick</h1>

      {/* 検索 */}
      <div style={{ display:'flex', gap:8, width:360, maxWidth:'90vw' }}>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=> e.key==='Enter' && tryGeolocateAndSearch()}
          placeholder="例：梅田 居酒屋 / なんば カフェ"
          style={{ flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)' }}
        />
        <button onClick={tryGeolocateAndSearch} disabled={loading}
          style={{ padding:'10px 12px', borderRadius:8, background:'var(--primary)', color:'var(--bg)', border:'none', minWidth:80 }}>
          {loading ? '検索中…' : '検索'}
        </button>
      </div>

      {error && (
        <div style={{ width:360, maxWidth:'90vw', padding:12, borderRadius:8, background:'rgba(239,68,68,0.12)', color:'var(--text)', border:'1px solid var(--border)' }}>
          {error}
        </div>
      )}

      {/* スワイプスタック */}
      <div style={{ position:'relative', width:360, maxWidth:'90vw', height:540 }}>
        {/* ローディングスケルトン */}
        {loading && (
          <div style={{ position:'absolute', inset:0, borderRadius:16, overflow:'hidden', background:'var(--card)', boxShadow:'0 10px 30px var(--elev)', display:'flex', flexDirection:'column' }}>
            <div className="skeleton-hero" style={{ height:'58%', background:'var(--chip)' }} />
            <div style={{ padding:14 }}>
              <div className="skeleton-line" style={{ width:'60%', height:18, background:'var(--chip)' }} />
              <div className="skeleton-line" style={{ width:'40%', height:14, marginTop:8, background:'var(--chip)' }} />
              <div className="skeleton-line" style={{ width:'50%', height:14, marginTop:8, background:'var(--chip)' }} />
            </div>
          </div>
        )}

        <AnimatePresence>
          {visibleRest.slice().reverse().map((c, i) => (
            <motion.div
              key={c.id}
              style={{
                position:'absolute', inset:0, borderRadius:16, overflow:'hidden',
                background:'var(--card)', color:'var(--text)', boxShadow:'0 10px 30px var(--elev)',
                translateY:(i+1)*14, scale:1-(i+1)*0.05, zIndex:100 - i, pointerEvents:'none'
              }}
              initial={{ opacity:0, scale:0.95 }}
              animate={{ opacity:1, scale:1-(i+1)*0.05 }}
              exit={{ opacity:0, scale:0.95 }}
            >
              <div style={{ width:'100%', height:'58%' }}>
                <AnimatedImage src={c.image} alt={c.name} variant="fade" />
              </div>
              <div style={{ padding:14, opacity:0.7 }}>
                <h2 style={{ margin:0, fontSize:18 }}>{c.name}</h2>
                <div style={{ color:'var(--text-muted)', fontSize:13 }}>次の候補（写真 {c.photosCount} 枚）</div>
              </div>
            </motion.div>
          ))}

          {top && !loading && (
            <SwipeableCard
              key={top.id}
              card={top}
              eager
              onTapImage={() => nextPhotoWithFetch(top.id)}
              onSwipeUp={() => { setDetailsPlaceId(top.id); setDetailsOpen(true); }}
              onSwiped={(dir) => {
                if (dir === 'right') addFavorite(top);
                setDeck(prev => prev.slice(1));
              }}
            />
          )}
        </AnimatePresence>

        {!top && !loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                        color:'var(--text-muted)', background:'var(--card)', borderRadius:16, textAlign:'center', padding:16, boxShadow:'0 10px 30px var(--elev)' }}>
            写真のある検索結果は以上です。条件を変えて再検索してください。
          </div>
        )}
      </div>

      {/* お気に入り：タブ（一覧 / タグ追加） */}
      <section style={{ width:360, maxWidth:'90vw' }} data-favorites="true">
        {/* タブヘッダ */}
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          {(['list','tag-add'] as const).map(k => {
            const active = favTab === k;
            return (
              <button
                key={k}
                onClick={()=> setFavTab(k)}
                style={{
                  flex:1, padding:'8px 0', borderRadius:8,
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--primary)' : 'var(--card)',
                  color: active ? 'var(--bg)' : 'var(--text)', fontWeight:700
                }}
              >
                {k === 'list' ? '一覧' : 'タグ追加'}
              </button>
            );
          })}
        </div>

        {favTab === 'list' ? (
          <>
            {/* 見出し（件数 + 「タグを追加」） */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>お気に入り</h2>
                {/* 件数の初回ズレを抑えるため suppressHydrationWarning を付与（任意） */}
                <span style={{ color:'var(--text-muted)', fontSize:12 }} suppressHydrationWarning>
                  {favorites.length} 件
                </span>
              </div>
              <button
                onClick={() => setShowGlobalAddBar(s => !s)}
                style={{ padding:'6px 10px', borderRadius:8, background:'var(--primary)', color:'var(--bg)', border:'none', fontSize:12 }}
              >
                タグを追加
              </button>
            </div>

            {/* お気に入り検索バー */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <input
                value={favFilterText}
                onChange={e => setFavFilterText(e.target.value)}
                placeholder="お気に入りを検索（名称／住所）"
                style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', fontSize:13 }}
              />
            </div>

            {/* 追加バー（トグル） */}
            {showGlobalAddBar && (
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <input
                  value={globalTagInput}
                  onChange={(e)=> setGlobalTagInput(e.target.value)}
                  placeholder="追加するタグ名（例：海鮮 / ワイン）"
                  style={{
                    flex:1, padding:'6px 10px', fontSize:12,
                    borderRadius:12, border:'1px solid var(--border)', background:'var(--card)'
                  }}
                />
                <button
                  onClick={applyGlobalTag}
                  disabled={globalTagInput.trim()===''}
                  style={{
                    padding:'6px 10px', borderRadius:12,
                    background: globalTagInput.trim()==='' ? 'var(--chip)' : 'var(--primary)',
                    color: globalTagInput.trim()==='' ? 'var(--text-muted)' : 'var(--bg)',
                    border:'none'
                  }}
                >
                  追加
                </button>
              </div>
            )}

            {/* タグフィルタチップ */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              {Array.from(new Set([...userTags, ...favorites.flatMap(f => f.tags || [])])).map(t => {
                const active = favFilterTags.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => setFavFilterTags(prev => { const n = new Set(prev); active ? n.delete(t) : n.add(t); return n; })}
                    style={{
                      padding:'4px 10px', borderRadius:999,
                      border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: active ? 'var(--primary)' : 'var(--card)',
                      color: active ? 'var(--bg)' : 'var(--text)', fontSize:12, fontWeight:700
                    }}
                  >
                    {t}
                  </button>
                );
              })}
              {favFilterTags.size > 0 && (
                <button onClick={()=> setFavFilterTags(new Set())}
                  style={{ padding:'4px 10px', borderRadius:999, background:'var(--chip)', border:'1px solid var(--border)', fontSize:12 }}>
                  クリア
                </button>
              )}
            </div>

            {/* 一覧（横：画像 / 中央：テキスト / 右：＋タグ・🗑 ） */}
            <div style={{ display:'grid', gap:10 }}>
              {filteredFavorites.length === 0 ? (
                <div style={{ padding:12, borderRadius:8, background:'var(--card)', color:'var(--text-muted)', fontSize:14, boxShadow:'0 10px 30px var(--elev)' }}>
                  条件に一致するお気に入りはありません
                </div>
              ) : (
                filteredFavorites.map((f) => (
                  <div key={f.id} style={{ borderRadius:10, overflow:'hidden', background:'var(--card)', color:'var(--text)', boxShadow:'0 4px 12px var(--elev)' }}>
                    <div style={{ display:'flex', alignItems:'stretch', height: CARD_IMG_SIZE }}>
                      {/* 左：画像（タップで詳細） */}
                      <div onClick={() => { setDetailsPlaceId(f.id); setDetailsOpen(true); }}
                           style={{ width: CARD_IMG_SIZE, height: CARD_IMG_SIZE, cursor:'pointer', position:'relative' }}>
                        <AnimatedImage src={f.image} alt={f.name} variant="fade" />
                      </div>

                      {/* 中央：本文（タイトルタップで詳細） */}
                      <div
                        onClick={() => { setDetailsPlaceId(f.id); setDetailsOpen(true); }}
                        style={{ flex:1, padding:'8px 10px', minWidth:0, cursor:'pointer', overflow:'hidden' }}
                      >
                        <div
                          style={{
                            fontWeight:700, lineHeight:1.2,
                            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'
                          }}
                        >
                          {f.name}
                        </div>
                        <div
                          style={{
                            color:'var(--text-muted)', fontSize:12, marginTop:6,
                            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'
                          }}
                        >
                          {f.address ?? ''}
                        </div>
                        {/* タグ表示（1行内スクロール可） */}
                        <div style={{
                          display:'flex', gap:6, marginTop:6, overflowX:'auto', whiteSpace:'nowrap'
                        }}>
                          {(f.tags||[]).map(t => (
                            <span key={t} style={{ padding:'2px 6px', borderRadius:999, background:'var(--chip)', fontSize:11, flex:'0 0 auto' }}>{t}</span>
                          ))}
                        </div>
                      </div>

                      {/* 右：縦スタック（＋タグ／🗑） */}
                      <div style={{
                        width:56, height:CARD_IMG_SIZE, borderLeft:'1px solid var(--border)',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'8px 6px', boxSizing:'border-box'
                      }}>
                        <button
                          title="このお店にタグを追加"
                          onClick={() => addSingleTagByPrompt(f)}
                          style={{
                            width:'100%', padding:'6px 0', fontSize:12,
                            border:'1px solid var(--border)', borderRadius:8, background:'var(--card)', color:'var(--text)'
                          }}
                        >
                          ＋タグ
                        </button>
                        <button
                          onClick={() => deleteFavorite(f.id)}
                          title="お気に入りから削除"
                          style={{
                            width:'100%', padding:'6px 0', fontSize:16,
                            border:'1px solid var(--border)', borderRadius:8, background:'var(--card)', color:'var(--text)'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* タグ追加タブ（追加バーを一番上・小型） */
          <div style={{ display:'grid', gap:12 }}>
            {/* 小型追加バー（上） */}
            <div style={{ display:'flex', gap:8 }}>
              <input
                value={tagInput}
                onChange={(e)=> setTagInput(e.target.value)}
                placeholder="追加するタグ名（例：海鮮 / ワイン）"
                style={{
                  flex:1, padding:'6px 10px', fontSize:12,
                  borderRadius:12, border:'1px solid var(--border)', background:'var(--card)'
                }}
              />
              <button
                onClick={applyTagToSelected}
                disabled={selectedFavIds.size===0 || tagInput.trim()===''}
                style={{
                  padding:'6px 10px', borderRadius:12,
                  background:(selectedFavIds.size===0 || tagInput.trim()==='') ? 'var(--chip)' : 'var(--primary)',
                  color:(selectedFavIds.size===0 || tagInput.trim()==='') ? 'var(--text-muted)' : 'var(--bg)',
                  border:'none', minWidth:72
                }}
              >
                追加
              </button>
            </div>

            <div style={{ color:'var(--text-muted)', fontSize:12 }}>
              まとめてタグ付けしたいお店を選択して、上の入力欄でタグを追加します。
            </div>

            {/* 既存タグチップ（タップで入力欄に反映） */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {existingAllTags.map(t => (
                <button key={t} onClick={()=> setTagInput(t)}
                  style={{ padding:'4px 10px', borderRadius:999, background:'var(--chip)', border:'1px solid var(--border)', fontSize:12 }}>
                  {t}
                </button>
              ))}
            </div>

            {/* お気に入り選択グリッド */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {favorites.map(f => {
                const checked = selectedFavIds.has(f.id);
                return (
                  <label key={f.id} style={{
                    position:'relative', borderRadius:10, overflow:'hidden', background:'var(--card)', color:'var(--text)', boxShadow:'0 4px 12px var(--elev)', cursor:'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=> {
                        setSelectedFavIds(prev => {
                          const n = new Set(prev); e.target.checked ? n.add(f.id) : n.delete(f.id); return n;
                        });
                      }}
                      style={{ position:'absolute', top:8, left:8, zIndex:2 }}
                    />
                    <img src={f.image} alt={f.name} style={{ width:'100%', height:96, objectFit:'cover' }} />
                    <div style={{ padding:8, fontSize:12, fontWeight:700 }}>{f.name}</div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 詳細モーダル */}
      <DetailsModal
        open={detailsOpen}
        onClose={()=>setDetailsOpen(false)}
        placeId={detailsPlaceId}
      />

      {/* テーマCSS・スケルトンCSS */}
      <style>{`
        ${themeVars}
        .skeleton-hero, .skeleton-line { animation: pulse 1.2s infinite ease-in-out; opacity:.6; }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </main>
  );
}
