/* eslint-disable @next/next/no-img-element */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  PanInfo,
  Variants,
} from 'framer-motion';
import { TagSheet, TagManager } from './TagSheets';
import FavoritesMap, { MapItem } from './components/FavoritesMap';
import SavedView from './components/SavedView';
import { Icon, type IconName } from './components/Icons';
import {
  ApiPlace,
  Favorite,
  LatLng,
  NAV_HEIGHT,
  NAV_OFFSET,
  typeLabel,
  shortAddress,
  PlaceCard,
  PlaceDetails,
  STORAGE_KEYS,
  distanceTo,
  encodeShare,
  formatCount,
  formatDistance,
  getRefFromImageUrl,
  mapsDirectionsUrl,
  mapsPlaceUrl,
  photoUrl,
  priceLabel,
  searchErrorMessage,
  toCards,
} from './lib/swipick';

/** ------------ 定数 ------------ */
const SWIPE_THRESHOLD = 120;
const VISIBLE_STACK = 3;
const CARD_IMG_SIZE = 88;
const PREFETCH_WHEN_LEFT = 3; // 残りがこの枚数以下になったら続きを取得
const MAX_SEEN = 1000;        // 見送り履歴の上限
const MAX_SHARE = 40;         // 共有リンクに含める上限（URLが長くなりすぎないように）


type Filters = { openNow: boolean; minRating: number; price: 0 | 1 | 2 | 3; maxDist: number };
const DEFAULT_FILTERS: Filters = { openNow: false, minRating: 0, price: 0, maxDist: 0 };

type SwipeDir = 'left' | 'right';
type HistoryEntry = { card: PlaceCard; dir: SwipeDir; addedFav: boolean };
type SearchStats = { query: string; raw: number; withPhoto: number; hidden: number };
type ErrorInfo = { message: string; detail?: string };

/** ------------ 詳細情報のキャッシュ（同じお店の再取得＝課金を避ける） ------------ */
const detailsCache = new Map<string, PlaceDetails>();
async function fetchDetails(placeId: string): Promise<PlaceDetails | null> {
  const hit = detailsCache.get(placeId);
  if (hit) return hit;
  const r = await fetch(`/api/details?placeId=${encodeURIComponent(placeId)}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const j = (await r.json()) as { details?: PlaceDetails };
  if (j.details) detailsCache.set(placeId, j.details);
  return j.details ?? null;
}

/** ------------ 検索API ------------ */
class SearchError extends Error {
  detail?: string;
  constructor(info: ErrorInfo) {
    super(info.message);
    this.detail = info.detail;
  }
}

async function fetchPlaces(params: URLSearchParams, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`/api/places?${params.toString()}`, { cache: 'no-store', signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new SearchError({ message: '通信に失敗しました。電波状況を確認して、もう一度お試しください。' });
  }
  let body: { cards?: ApiPlace[]; nextPageToken?: string | null; error?: string; g_status?: string; g_error?: string } | null = null;
  try {
    body = await res.json();
  } catch {}
  if (!res.ok || !Array.isArray(body?.cards)) {
    throw new SearchError(searchErrorMessage(res.status, body));
  }
  return { cards: body!.cards as ApiPlace[], nextPageToken: body!.nextPageToken ?? null };
}

/** ------------ 絞り込み ------------ */
function passesFilters(c: PlaceCard, f: Filters, pos: LatLng | null) {
  if (f.openNow && c.openNow !== true) return false;
  if (f.minRating > 0 && (c.rating ?? 0) < f.minRating) return false;
  if (f.price) {
    const lv = c.priceLevel;
    if (lv == null) return false;
    if (f.price === 1 && lv > 1) return false;
    if (f.price === 2 && lv !== 2) return false;
    if (f.price === 3 && lv < 3) return false;
  }
  if (f.maxDist > 0 && pos) {
    const d = distanceTo(pos, c.lat, c.lng);
    if (d == null || d > f.maxDist) return false;
  }
  return true;
}

function isFilterActive(f: Filters) {
  return f.openNow || f.minRating > 0 || f.price !== 0 || f.maxDist > 0;
}

/** 初回は initial、マウント後に localStorage を反映。読み込み完了までは書き込まない */
function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value, loaded]);
  return [value, setValue, loaded] as const;
}

/** ------------ 共通の小さな部品 ------------ */
const chipBase = (active: boolean): React.CSSProperties => ({
  flex: '0 0 auto',
  padding: '6px 12px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--card)',
  color: active ? 'var(--bg)' : 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
});

const smallBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 12,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

function MetaLine({ c, pos }: { c: PlaceCard; pos: LatLng | null }) {
  const parts: React.ReactNode[] = [];
  if (c.rating != null) {
    parts.push(
      <span key="r">
        <span style={{ color: '#f59e0b' }}>★</span> {c.rating.toFixed(1)}
        <span style={{ opacity: 0.7 }}>（{formatCount(c.userRatingsTotal)}件）</span>
      </span>
    );
  }
  const price = priceLabel(c.priceLevel);
  if (price) parts.push(<span key="p">{price}</span>);
  const dist = formatDistance(distanceTo(pos, c.lat, c.lng));
  if (dist) parts.push(<span key="d">📏 {dist}</span>);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center' }}>
      {parts}
    </div>
  );
}

/** ------------ 画像アニメ ------------ */
function AnimatedImage({
  src,
  alt,
  onClick,
  variant = 'slide',
}: {
  src: string;
  alt: string;
  onClick?: () => void;
  variant?: 'fade' | 'slide';
}) {
  if (!src) {
    return (
      <div
        onClick={onClick}
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--chip)', color: 'var(--text-muted)', fontSize: 24,
        }}
      >
        🍽
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          onClick={onClick}
          draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            cursor: onClick ? 'pointer' : 'default',
          }}
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
  open, onClose, placeId, fallbackName,
}: { open: boolean; onClose: () => void; placeId: string; fallbackName?: string }) {
  const [loading, setLoading] = useState(false);
  const [d, setD] = useState<PlaceDetails | null>(null);

  useEffect(() => {
    if (!open || !placeId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setD(null);
    fetchDetails(placeId)
      .then((res) => { if (!cancelled) setD(res); })
      .catch(() => { if (!cancelled) setD(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, placeId]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const weekdays = d?.openingHours?.weekday_text ?? [];
  const todayText = (() => {
    if (weekdays.length === 0) return null;
    const i = new Date().getDay(); // 0=日
    const wd = ['日', '月', '火', '水', '木', '金', '土'][i];
    return weekdays.find((s) => s.startsWith(wd)) ?? weekdays[(i + 6) % 7] ?? null;
  })();
  const name = d?.name ?? fallbackName ?? '';
  const price = priceLabel(d?.priceLevel);
  const openNow = d?.openingHours?.open_now ?? null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(92vw, 520px)', maxHeight: '88vh', overflow: 'auto',
          background: 'var(--card)', color: 'var(--text)', borderRadius: 14,
          padding: '60px 18px 18px', position: 'relative', boxShadow: '0 10px 30px var(--elev)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          style={{
            position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22,
            background: 'var(--chip)', border: 'none', color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="close" size={24} />
        </button>

        {loading && <div style={{ padding: '24px 0' }}>読み込み中…</div>}
        {!loading && d && (
          <>
            <h2 className="jp-text jp-title" style={{ margin: '-40px 56px 6px 0', fontSize: 20, lineHeight: 1.35, minHeight: 44, display: 'flex', alignItems: 'center' }}>{name}</h2>
            <div className="jp-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{shortAddress(d.address)}</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8, fontSize: 14 }}>
              {d.rating != null && (
                <span><span style={{ color: '#f59e0b' }}>★</span> {d.rating.toFixed(1)}（{formatCount(d.userRatingsTotal)}件）</span>
              )}
              {price && <span>目安 {price}</span>}
              {openNow != null && (
                <span style={{ color: openNow ? '#10b981' : 'var(--text-muted)', fontWeight: 700 }}>
                  {openNow ? '営業中' : '営業時間外'}
                </span>
              )}
            </div>

            {/* 行動ボタン（1行・アイコン付き） */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {([
                { key: 'route', label: '経路', icon: 'directions', href: mapsDirectionsUrl(name, placeId), primary: true },
                { key: 'map', label: '地図', icon: 'map', href: d.mapUrl ?? mapsPlaceUrl(name, placeId) },
                ...(d.phone ? [{ key: 'tel', label: '電話', icon: 'call', href: `tel:${d.phone.replace(/[^\d+]/g, '')}` }] : []),
                ...(d.website ? [{ key: 'web', label: 'サイト', icon: 'link', href: d.website }] : []),
              ] as { key: string; label: string; icon: IconName; href: string; primary?: boolean }[]).map((b) => (
                <a
                  key={b.key}
                  href={b.href}
                  {...(b.key === 'tel' ? {} : { target: '_blank', rel: 'noreferrer' })}
                  style={{
                    flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '10px 4px', borderRadius: 12, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                    background: b.primary ? 'var(--accent)' : 'transparent',
                    color: b.primary ? '#fff' : 'var(--accent)',
                    border: b.primary ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <Icon name={b.icon} size={22} />
                  {b.label}
                </a>
              ))}
            </div>

            {todayText && (
              <div style={{ marginTop: 14, fontSize: 14 }}>
                <b>今日の営業時間</b>
                <div>{todayText}</div>
                {weekdays.length > 1 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>すべての曜日</summary>
                    <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 4 }}>
                      {weekdays.map((w) => <div key={w}>{w}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}
            {d.phone && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>電話：{d.phone}</div>}

            {d.photoRefs?.length > 0 && (
              <>
                <div style={{ marginTop: 14, fontWeight: 700 }}>写真</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {d.photoRefs.slice(0, 6).map((ref, i) => (
                    <img key={ref} src={photoUrl(ref, 600)} alt={`${name} の写真 ${i + 1}`} loading="lazy"
                      style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {!loading && !d && <div style={{ padding: '24px 0' }}>情報を取得できませんでした。少し待ってから開き直してください。</div>}
      </div>
    </div>
  );
}

/** ------------ 先頭カード（上=詳細 / 横=LIKE・NOPE） ------------ */
const cardVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: (dir: SwipeDir | null) => ({
    x: dir === 'right' ? 520 : dir === 'left' ? -520 : 0,
    rotate: dir === 'right' ? 15 : dir === 'left' ? -15 : 0,
    opacity: 0,
    transition: { duration: 0.28 },
  }),
};

function SwipeableCard({
  card,
  userPos,
  onSwiped,
  onSwipeUp,
  onTapImage,
}: {
  card: PlaceCard;
  userPos: LatLng | null;
  onSwiped: (dir: SwipeDir) => void;
  onSwipeUp: () => void;
  onTapImage: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const likeOpacity = useTransform(x, [40, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -40], [1, 0]);

  /** 画像エリア内から開始したか（上フリック許可） */
  const gestureInImageRef = useRef(false);
  const imgAreaRef = useRef<HTMLDivElement | null>(null);

  /** iOS Safari でのみネイティブ touchmove を passive:false で付与（警告回避） */
  const [needNativePrevent, setNeedNativePrevent] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    const isIOS = /iP(hone|ad|od)/i.test(ua);
    const isWebKit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNeedNativePrevent(isIOS && isWebKit);
  }, []);

  useEffect(() => {
    const el = imgAreaRef.current;
    if (!el || !needNativePrevent) return;
    const onTouchMoveNative = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMoveNative);
  }, [needNativePrevent]);

  /** 上フリック判定（offset/velocity ベース） */
  const onPanEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const verticalIntent = Math.abs(offset.y) >= Math.abs(offset.x) * 1.4; // 誤爆抑制
    if (gestureInImageRef.current && verticalIntent && (offset.y < -80 || velocity.y < -300)) {
      onSwipeUp();
    }
    gestureInImageRef.current = false;
  };

  const total = Math.max(1, card.photoRefs?.length || card.photosCount || 1);
  const idx = (card.currentIdx ?? 0) + 1;

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden',
        background: 'var(--card)', color: 'var(--text)', boxShadow: '0 10px 30px var(--elev)',
        x, rotate,
        touchAction: 'pan-y',
        zIndex: 1000,
      }}
      drag="x"
      dragElastic={0.2}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        const ox = info.offset.x;
        const vx = info.velocity.x;
        if (ox > SWIPE_THRESHOLD || (ox > 40 && vx > 600)) onSwiped('right');
        else if (ox < -SWIPE_THRESHOLD || (ox < -40 && vx < -600)) onSwiped('left');
        else x.set(0);
      }}
      onPanEnd={onPanEnd}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* LIKE/NOPE */}
      <motion.div style={{
        position: 'absolute', top: 18, left: 16, padding: '6px 12px',
        borderRadius: 8, border: '3px solid #10b981', color: '#10b981', background: 'rgba(255,255,255,0.85)',
        fontWeight: 800, fontSize: 18, opacity: likeOpacity, pointerEvents: 'none', zIndex: 7, rotate: -12,
      }}>LIKE</motion.div>
      <motion.div style={{
        position: 'absolute', top: 18, right: 16, padding: '6px 12px',
        borderRadius: 8, border: '3px solid #ef4444', color: '#ef4444', background: 'rgba(255,255,255,0.85)',
        fontWeight: 800, fontSize: 18, opacity: nopeOpacity, pointerEvents: 'none', zIndex: 7, rotate: 12,
      }}>NOPE</motion.div>

      {/* 画像エリア（ここだけスクロール抑止） */}
      <div
        ref={imgAreaRef}
        data-image-area="true"
        onPointerDownCapture={() => { gestureInImageRef.current = true; }}
        style={{
          position: 'relative', width: '100%', height: '60%',
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        <AnimatedImage src={card.image} alt={card.name} onClick={onTapImage} variant="slide" />

        {/* 写真の枚数インジケータ */}
        {total > 1 && (
          <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', gap: 4, padding: '0 10px', zIndex: 6, pointerEvents: 'none' }}>
            {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i === (idx - 1) % 10 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
              }} />
            ))}
          </div>
        )}

        {/* 詳細ボタン */}
        <button
          onClick={onSwipeUp}
          aria-label="詳細を開く"
          style={{
            position: 'absolute', left: 10, top: 18, zIndex: 6,
            padding: '6px 10px', borderRadius: 999,
            background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', fontSize: 12,
          }}
        >
          詳細
        </button>

        {/* 営業状況バッジ */}
        <div style={{
          position: 'absolute', left: 10, bottom: 10, padding: '4px 10px',
          borderRadius: 999, zIndex: 6, color: '#fff', fontSize: 12, fontWeight: 700,
          background: card.openNow === true ? 'rgba(16,185,129,0.92)' : card.openNow === false ? 'rgba(107,114,128,0.92)' : 'rgba(0,0,0,0.45)',
        }}>
          {card.openNow === true ? '営業中' : card.openNow === false ? '営業時間外' : '営業時間不明'}
        </div>

        {/* タップヒント */}
        <div aria-hidden="true" className="tap-hint" style={{
          position: 'absolute', right: 10, bottom: 10, zIndex: 6,
          padding: '6px 10px', borderRadius: 999,
          background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 12,
          pointerEvents: 'none', userSelect: 'none',
        }}>
          タップで写真切替 / ↑で詳細
        </div>
      </div>

      {/* 店名＋評価・価格・距離＋住所 */}
      <div style={{ padding: '12px 14px' }}>
        <h2 className="jp-text jp-title" style={{ margin: '0 0 6px', fontSize: 19, lineHeight: 1.3 }}>{card.name}</h2>
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          <MetaLine c={card} pos={userPos} />
        </div>
        {card.address && (
          <div className="jp-text" style={{
            color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            📍 {shortAddress(card.address)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** ------------ ページ本体 ------------ */
export default function Home() {
  /** 保存データ */
  const [favorites, setFavorites, favLoaded] = usePersistent<Favorite[]>(STORAGE_KEYS.favorites, []);
  const [userTags, setUserTags] = usePersistent<string[]>(STORAGE_KEYS.tags, ['カフェ', '居酒屋', 'バー']);
  const [seenIds, setSeenIds, seenLoaded] = usePersistent<string[]>(STORAGE_KEYS.seen, []);
  const [filtersRaw, setFiltersRaw] = usePersistent<Filters>(STORAGE_KEYS.filters, DEFAULT_FILTERS);
  const filters: Filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...filtersRaw }), [filtersRaw]);
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => setFiltersRaw((prev) => ({ ...DEFAULT_FILTERS, ...prev, [k]: v }));

  /** 検索 */
  const [q, setQ] = useState('梅田 居酒屋');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [deck, setDeck] = useState<PlaceCard[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  /** スワイプ履歴（やり直し用）・飛ばす方向（アニメ用） */
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [exitDir, setExitDir] = useState<SwipeDir | null>(null);

  /** 最新値を非同期処理から参照するための ref */
  const seenRef = useRef<string[]>(seenIds);
  const favRef = useRef<Favorite[]>(favorites);
  const userPosRef = useRef<LatLng | null>(null);
  useEffect(() => { seenRef.current = seenIds; }, [seenIds]);
  useEffect(() => { favRef.current = favorites; }, [favorites]);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  // 詳細モーダル
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPlaceId, setDetailsPlaceId] = useState<string>('');
  const [detailsName, setDetailsName] = useState<string>('');
  const openDetails = useCallback((id: string, name?: string) => {
    setDetailsPlaceId(id);
    setDetailsName(name ?? '');
    setDetailsOpen(true);
  }, []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  // 下タブ（探す / 保存済み / 地図）
  type MainTab = 'search' | 'saved' | 'map';
  const [tab, setTab] = useState<MainTab>('search');
  const [mapTag, setMapTag] = useState<string | null>(null);
  const [mapQuery, setMapQuery] = useState('');

  // タグ編集シートの対象（お店のID。複数ならまとめて編集）／タグ管理
  const [tagSheetIds, setTagSheetIds] = useState<string[]>([]);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  // 絞り込みパネル
  const [filterOpen, setFilterOpen] = useState(false);

  // トースト（短い通知＋元に戻す）
  const [toast, setToast] = useState<{ id: number; msg: string; actionLabel?: string; action?: () => void } | null>(null);
  const showToast = useCallback((msg: string, actionLabel?: string, action?: () => void) => {
    setToast({ id: Date.now() + Math.random(), msg, actionLabel, action });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    const t = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /** 表示中のデッキ（絞り込み適用後） */
  const shownDeck = useMemo(() => deck.filter((c) => passesFilters(c, filters, userPos)), [deck, filters, userPos]);
  const top = shownDeck[0];
  const visibleRest = useMemo(() => shownDeck.slice(1, VISIBLE_STACK), [shownDeck]);

  /** 除外するID（見送り済み・お気に入り済み） */
  const excludedIds = () => new Set([...seenRef.current, ...favRef.current.map((f) => f.id)]);

  /** 検索（1ページ目） */
  async function searchCore(query: string, withGeo?: LatLng | null) {
    const myId = ++searchIdRef.current;
    const trimmed = query.trim();
    if (!trimmed) {
      setError({ message: 'キーワードを入力してください（例：梅田 居酒屋）' });
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      setExitDir(null); // 前回のスワイプ方向で古いカードが飛んでいかないように
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const params = new URLSearchParams({ q: trimmed });
      if (withGeo) { params.set('lat', String(withGeo.lat)); params.set('lng', String(withGeo.lng)); }
      const { cards, nextPageToken } = await fetchPlaces(params, abortRef.current.signal);
      if (myId !== searchIdRef.current) return;

      const items = toCards(cards).sort((a, b) => b.photosCount - a.photosCount);
      const ex = excludedIds();
      const fresh = items.filter((c) => !ex.has(c.id));

      setDeck(fresh);
      setNextToken(nextPageToken);
      setStats({ query: trimmed, raw: cards.length, withPhoto: items.length, hidden: items.length - fresh.length });
      setHistory([]);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      if (myId !== searchIdRef.current) return;
      const se = e as SearchError;
      setError({ message: se.message || '検索に失敗しました。', detail: se.detail });
    } finally {
      if (myId === searchIdRef.current) setLoading(false);
    }
  }

  function search(query: string = q) {
    if (!('geolocation' in navigator)) { searchCore(query); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        searchCore(query, p);
      },
      () => searchCore(query, userPosRef.current),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 }
    );
  }

  /** 続きのページ（最大60件まで） */
  async function loadMore() {
    if (!nextToken || loadingMoreRef.current) return;
    const myId = searchIdRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { cards, nextPageToken } = await fetchPlaces(new URLSearchParams({ pagetoken: nextToken }));
      if (myId !== searchIdRef.current) return;
      const items = toCards(cards).sort((a, b) => b.photosCount - a.photosCount);
      const ex = excludedIds();
      setDeck((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...items.filter((c) => !ex.has(c.id) && !ids.has(c.id))];
      });
      setStats((s) => s && ({ ...s, raw: s.raw + cards.length, withPhoto: s.withPhoto + items.length }));
      setNextToken(nextPageToken);
    } catch {
      if (myId === searchIdRef.current) setNextToken(null); // 続きは諦める（今のカードはそのまま）
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  // 初回：保存データの読み込みが終わってから検索（見送り済みを正しく除外するため）
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!favLoaded || !seenLoaded || didInitRef.current) return;
    didInitRef.current = true;
    search(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favLoaded, seenLoaded]);

  // 続きのページ（最大60件）を先読みする。残りが少ないときは即、そうでなければ少し待ってから
  useEffect(() => {
    if (loading || !nextToken) return;
    const t = setTimeout(loadMore, shownDeck.length <= PREFETCH_WHEN_LEFT ? 0 : 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownDeck.length, nextToken, loading]);

  /** 画像切替（不足時は Details から補完） */
  async function nextPhotoWithFetch(placeId: string) {
    const card = deck.find((c) => c.id === placeId);
    if (!card) return;

    if (!card.photoRefs || card.photoRefs.length <= 1) {
      try {
        const det = await fetchDetails(placeId);
        const extra = (det?.photoRefs ?? []).filter(Boolean);
        if (extra.length) {
          setDeck((prev) => prev.map((c) => {
            if (c.id !== placeId) return c;
            const refs = Array.from(new Set([...(c.photoRefs || []), ...extra]));
            return { ...c, photoRefs: refs, photosCount: refs.length };
          }));
        }
      } catch {}
    }

    setDeck((prev) => prev.map((c) => {
      if (c.id !== placeId) return c;
      const total = c.photoRefs?.length || 1;
      const next = ((c.currentIdx ?? 0) + 1) % total;
      const ref = c.photoRefs[next] ?? getRefFromImageUrl(c.image);
      return { ...c, currentIdx: next, image: photoUrl(ref) };
    }));
  }

  /** スワイプ・やり直し */
  function handleSwipe(card: PlaceCard, dir: SwipeDir) {
    setExitDir(dir);
    const already = favorites.some((f) => f.id === card.id);
    if (dir === 'right') {
      if (!already) setFavorites((prev) => (prev.some((p) => p.id === card.id) ? prev : [...prev, { ...card, tags: [], addedAt: Date.now() }]));
    } else {
      setSeenIds((prev) => (prev.includes(card.id) ? prev : [...prev, card.id].slice(-MAX_SEEN)));
    }
    setHistory((prev) => [...prev, { card, dir, addedFav: dir === 'right' && !already }].slice(-30));
    setDeck((prev) => prev.filter((c) => c.id !== card.id));
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setExitDir(null);
    setHistory((prev) => prev.slice(0, -1));
    if (last.dir === 'right' && last.addedFav) setFavorites((prev) => prev.filter((f) => f.id !== last.card.id));
    if (last.dir === 'left') setSeenIds((prev) => prev.filter((id) => id !== last.card.id));
    setDeck((prev) => [last.card, ...prev.filter((c) => c.id !== last.card.id)]);
  }

  function resetSeen() {
    setSeenIds([]);
    seenRef.current = [];
    showToast('見送り履歴をリセットしました');
    searchCore(stats?.query ?? q, userPosRef.current);
  }

  // キーボード操作（PC向け）：← NOPE / → LIKE / ↑ 詳細 / Backspace 戻す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (tab !== 'search' || detailsOpen || tagSheetIds.length > 0 || tagManagerOpen) return;
      if (e.key === 'ArrowRight' && top) { e.preventDefault(); handleSwipe(top, 'right'); }
      else if (e.key === 'ArrowLeft' && top) { e.preventDefault(); handleSwipe(top, 'left'); }
      else if (e.key === 'ArrowUp' && top) { e.preventDefault(); openDetails(top.id, top.name); }
      else if (e.key === 'Backspace' && history.length > 0) { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** タグの件数・一覧 */
  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of favorites) for (const t of f.tags || []) m[t] = (m[t] || 0) + 1;
    return m;
  }, [favorites]);

  const existingAllTags = useMemo(
    () => Array.from(new Set([...userTags, ...favorites.flatMap((f) => f.tags || [])])),
    [userTags, favorites]
  );

  /** お気に入り操作 */
  function deleteFavorite(id: string) {
    const idx = favorites.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const removed = favorites[idx];
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    setTagSheetIds((prev) => prev.filter((x) => x !== id));
    const short = removed.name.length > 12 ? `${removed.name.slice(0, 12)}…` : removed.name;
    showToast(`「${short}」を削除しました`, '元に戻す', () => {
      setFavorites((prev) => (prev.some((f) => f.id === id) ? prev : [...prev.slice(0, idx), removed, ...prev.slice(idx)]));
    });
  }

  /** タグ操作：まとめて付け外し／新規作成／全体の名前変更・削除 */
  function toggleTagOn(ids: string[], tag: string) {
    const target = new Set(ids);
    setFavorites((prev) => {
      const targets = prev.filter((f) => target.has(f.id));
      // 全員が持っていれば外す、そうでなければ全員に付ける
      const allHave = targets.length > 0 && targets.every((f) => (f.tags || []).includes(tag));
      return prev.map((f) => {
        if (!target.has(f.id)) return f;
        const cur = f.tags || [];
        if (allHave) return { ...f, tags: cur.filter((t) => t !== tag) };
        return cur.includes(tag) ? f : { ...f, tags: [...cur, tag] };
      });
    });
  }
  function createTagOn(ids: string[], raw: string) {
    const t = raw.trim();
    if (!t) return;
    const target = new Set(ids);
    setFavorites((prev) => prev.map((f) =>
      target.has(f.id) ? { ...f, tags: Array.from(new Set([...(f.tags || []), t])) } : f
    ));
    setUserTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }
  function createTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (existingAllTags.includes(t)) {
      showToast('既に存在するタグです');
      return;
    }
    setUserTags((prev) => [...prev, t]);
  }
  function renameTag(oldName: string, raw: string) {
    const n = raw.trim();
    if (!n || n === oldName) return;
    setFavorites((prev) => prev.map((f) =>
      (f.tags || []).includes(oldName)
        ? { ...f, tags: Array.from(new Set(f.tags.map((t) => (t === oldName ? n : t)))) }
        : f
    ));
    setUserTags((prev) => Array.from(new Set(prev.map((t) => (t === oldName ? n : t)))));
    setMapTag((prev) => (prev === oldName ? n : prev));
  }
  function deleteTag(tag: string) {
    setFavorites((prev) => prev.map((f) =>
      (f.tags || []).includes(tag) ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f
    ));
    setUserTags((prev) => prev.filter((t) => t !== tag));
    setMapTag((prev) => (prev === tag ? null : prev));
  }

  /** タグ編集シートの対象 */
  const sheetFavs = useMemo(() => favorites.filter((f) => tagSheetIds.includes(f.id)), [favorites, tagSheetIds]);
  const sheetActiveTags = useMemo(
    () => existingAllTags.filter((t) => sheetFavs.length > 0 && sheetFavs.every((f) => f.tags?.includes(t))),
    [existingAllTags, sheetFavs]
  );

  /** 地図タブ */
  const effMapTag = mapTag !== null && existingAllTags.includes(mapTag) ? mapTag : null;
  const mapFavorites = useMemo(
    () => {
      let arr = effMapTag !== null ? favorites.filter((f) => f.tags?.includes(effMapTag)) : favorites;
      // フリーワード：スペース区切りは AND（店名・住所・タグ・ジャンルが対象）
      const words = mapQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        arr = arr.filter((f) => {
          const hay = [f.name, f.address ?? '', typeLabel(f.types), ...(f.tags ?? [])].join(' ').toLowerCase();
          return words.every((w) => hay.includes(w));
        });
      }
      return arr;
    },
    [favorites, effMapTag, mapQuery]
  );
  const mapItems: MapItem[] = useMemo(() => mapFavorites
    .filter((f) => f.lat != null && f.lng != null)
    .map((f) => {
      const sub = [
        f.rating != null ? `★${f.rating.toFixed(1)}` : null,
        priceLabel(f.priceLevel),
        formatDistance(distanceTo(userPos, f.lat, f.lng)),
      ].filter(Boolean).join(' · ');
      return { id: f.id, name: f.name, lat: f.lat as number, lng: f.lng as number, sub, href: mapsPlaceUrl(f.name, f.id) };
    }), [mapFavorites, userPos]);
  const openDetailsById = useCallback((id: string) => openDetails(id), [openDetails]);

  function selectTab(next: MainTab) {
    setTab(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }
  const accentChip = (active: boolean): React.CSSProperties => ({
    ...chipBase(false),
    border: active ? '1px solid transparent' : '1px solid var(--border)',
    background: active ? 'var(--accent-bg)' : 'var(--card)',
    color: active ? 'var(--accent)' : 'var(--text)',
    fontWeight: active ? 700 : 500,
  });

  /** 共有リンク */
  async function shareFavorites(list: Favorite[]) {
    if (list.length === 0) { showToast('共有するお気に入りがありません'); return; }
    const items = list.slice(0, MAX_SHARE);
    const url = `${window.location.origin}/share?f=${encodeShare(items)}`;
    const note = list.length > MAX_SHARE ? `（先頭${MAX_SHARE}件）` : '';
    const text = `Swipickのお気に入り ${items.length}件${note}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Swipick', text, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return; // 共有シートを閉じただけ
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(`共有リンクをコピーしました${note}`);
    } catch {
      window.prompt('このリンクをコピーして送ってください', url);
    }
  }

  /** バックアップ（書き出し・読み込み） */
  function exportBackup() {
    const data = { app: 'swipick', version: 1, exportedAt: new Date().toISOString(), favorites, tags: userTags };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `swipick-backup-${ymd}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`お気に入り${favorites.length}件を書き出しました`);
  }

  async function importBackup(file: File) {
    try {
      const data: unknown = JSON.parse(await file.text());
      const obj = (data && typeof data === 'object' ? data : {}) as { favorites?: unknown; tags?: unknown };
      const list: unknown = Array.isArray(data) ? data : obj.favorites;
      if (!Array.isArray(list)) throw new Error('invalid');

      const incoming: Favorite[] = [];
      for (const x of list) {
        if (!x || typeof x !== 'object') continue;
        const o = x as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.name !== 'string') continue;
        const refs = Array.isArray(o.photoRefs) ? o.photoRefs.filter((r): r is string => typeof r === 'string') : [];
        const image = typeof o.image === 'string' && o.image.startsWith('/api/photo') ? o.image : (refs[0] ? photoUrl(refs[0]) : '');
        incoming.push({
          id: o.id,
          name: o.name,
          image,
          openNow: null,
          photosCount: refs.length || 1,
          photoRefs: refs,
          currentIdx: 0,
          address: typeof o.address === 'string' ? o.address : null,
          types: Array.isArray(o.types) ? o.types.filter((t): t is string => typeof t === 'string') : [],
          lat: typeof o.lat === 'number' ? o.lat : null,
          lng: typeof o.lng === 'number' ? o.lng : null,
          rating: typeof o.rating === 'number' ? o.rating : null,
          userRatingsTotal: typeof o.userRatingsTotal === 'number' ? o.userRatingsTotal : 0,
          priceLevel: typeof o.priceLevel === 'number' ? o.priceLevel : null,
          tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
          addedAt: typeof o.addedAt === 'number' ? o.addedAt : undefined,
        });
      }

      // 既存とマージ（同じお店はタグを合体、新しいお店は末尾に追加）
      const merged = [...favorites];
      const index = new Map<string, number>(merged.map((f, i): [string, number] => [f.id, i]));
      let added = 0;
      for (const f of incoming) {
        const i = index.get(f.id);
        if (i != null) {
          merged[i] = { ...merged[i], tags: Array.from(new Set([...(merged[i].tags || []), ...f.tags])) };
        } else {
          index.set(f.id, merged.length);
          merged.push(f);
          added++;
        }
      }
      setFavorites(merged);
      const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [];
      setUserTags((prev) => Array.from(new Set([...prev, ...tags, ...incoming.flatMap((f) => f.tags)])));
      showToast(`読み込みました（追加 ${added}件 / 既存 ${incoming.length - added}件）`);
    } catch {
      showToast('読み込めませんでした。Swipickで書き出したファイルを選んでください。');
    }
  }

  const filterActive = isFilterActive(filters);
  const selectStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, width: '100%',
  };

  /** 空状態の説明 */
  function renderEmptyState() {
    let title = '';
    let body: React.ReactNode = null;
    if (!stats) {
      title = 'キーワードで検索してください';
    } else if (deck.length > 0 && shownDeck.length === 0) {
      title = '絞り込み条件に合うお店がありません';
      body = (
        <button onClick={() => setFiltersRaw(DEFAULT_FILTERS)} style={{ ...smallBtn, marginTop: 12, padding: '8px 14px', fontSize: 13 }}>
          絞り込みを解除
        </button>
      );
    } else if (stats.raw === 0) {
      title = `「${stats.query}」の検索結果は0件でした`;
      body = <div style={{ fontSize: 13, marginTop: 6 }}>エリア名やジャンルを変えてお試しください。</div>;
    } else if (stats.withPhoto === 0) {
      title = '写真のあるお店が見つかりませんでした';
      body = <div style={{ fontSize: 13, marginTop: 6 }}>キーワードを変えてお試しください。</div>;
    } else {
      title = 'この検索のお店は全部見ました 🎉';
      body = (
        <div style={{ display: 'grid', gap: 8, marginTop: 12, justifyItems: 'center' }}>
          <div style={{ fontSize: 13 }}>エリアやジャンルを変えて探してみましょう。</div>
          {seenIds.length > 0 && (
            <button onClick={resetSeen} style={{ ...smallBtn, padding: '8px 14px', fontSize: 13 }}>
              見送ったお店（{seenIds.length}件）をもう一度表示
            </button>
          )}
        </div>
      );
    }
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', background: 'var(--card)', borderRadius: 16,
        textAlign: 'center', padding: 20, boxShadow: '0 10px 30px var(--elev)',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {body}
      </div>
    );
  }

  const actionBtn = (color: string, size = 56): React.CSSProperties => ({
    width: size, height: size, borderRadius: '50%', border: 'none',
    background: 'var(--card)', color, fontSize: size * 0.42, fontWeight: 800,
    boxShadow: '0 4px 14px var(--elev)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <main
      style={{
        minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)',
        paddingBottom: NAV_OFFSET,
      }}
    >
      {/* ===== 探す ===== */}
      <div
        style={{
          display: tab === 'search' ? 'flex' : 'none',
          flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: 'max(12px, env(safe-area-inset-top)) 16px 8px',
        }}
      >
      {/* 検索 */}
      <form
        onSubmit={(e) => { e.preventDefault(); search(q); }}
        style={{ display: 'flex', gap: 8, width: 360, maxWidth: '100%' }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
          placeholder="例：梅田 居酒屋 / なんば カフェ"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 16 }}
        />
        <button type="submit" disabled={loading}
          style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--primary)', color: 'var(--bg)', border: 'none', minWidth: 72, fontWeight: 700 }}>
          {loading ? '検索中…' : '検索'}
        </button>
      </form>

      {/* 絞り込み */}
      <div style={{ width: 360, maxWidth: '100%' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setFilterOpen((o) => !o)} style={{ ...chipBase(filterActive), display: 'inline-flex', gap: 6 }}>
            絞り込み{filterActive ? '（ON）' : ''} {filterOpen ? '▲' : '▼'}
          </button>
          <button onClick={() => setFilter('openNow', !filters.openNow)} style={chipBase(filters.openNow)}>
            営業中のみ
          </button>
          {filterActive && (
            <button onClick={() => setFiltersRaw(DEFAULT_FILTERS)} style={{ ...smallBtn, borderRadius: 999 }}>解除</button>
          )}
        </div>
        {filterOpen && (
          <div style={{
            marginTop: 8, padding: 12, borderRadius: 12, background: 'var(--card)', boxShadow: '0 4px 12px var(--elev)',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12,
          }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>評価</span>
              <select value={filters.minRating} onChange={(e) => setFilter('minRating', Number(e.target.value))} style={selectStyle}>
                <option value={0}>指定なし</option>
                <option value={3.5}>★3.5以上</option>
                <option value={4}>★4.0以上</option>
                <option value={4.5}>★4.5以上</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>価格</span>
              <select value={filters.price} onChange={(e) => setFilter('price', Number(e.target.value) as Filters['price'])} style={selectStyle}>
                <option value={0}>指定なし</option>
                <option value={1}>〜1,000円</option>
                <option value={2}>1,000〜3,000円</option>
                <option value={3}>3,000円〜</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>距離</span>
              <select value={filters.maxDist} onChange={(e) => setFilter('maxDist', Number(e.target.value))} style={selectStyle}>
                <option value={0}>指定なし</option>
                <option value={500}>500m以内</option>
                <option value={1000}>1km以内</option>
                <option value={3000}>3km以内</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              ※ 価格・評価の情報がないお店は、その条件を指定すると表示されません。
              {filters.maxDist > 0 && !userPos && ' 距離の絞り込みには位置情報の許可が必要です。'}
            </div>
          </div>
        )}
      </div>

      {/* エラー */}
      {error && (
        <div role="alert" style={{
          width: 360, maxWidth: '100%', padding: 12, borderRadius: 10, boxSizing: 'border-box',
          background: 'rgba(239,68,68,0.12)', color: 'var(--text)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 14,
        }}>
          <div style={{ fontWeight: 700 }}>⚠️ {error.message}</div>
          {error.detail && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)', wordBreak: 'break-word' }}>{error.detail}</div>}
          <button onClick={() => search(q)} style={{ ...smallBtn, marginTop: 8 }}>再試行</button>
        </div>
      )}

      {/* スワイプスタック */}
      <div style={{ position: 'relative', width: 360, maxWidth: '100%', height: 'clamp(340px, calc(100dvh - 320px), 560px)' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden',
            background: 'var(--card)', boxShadow: '0 10px 30px var(--elev)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div className="skeleton-hero" style={{ height: '60%', background: 'var(--chip)' }} />
            <div style={{ padding: 14 }}>
              <div className="skeleton-line" style={{ width: '60%', height: 18, background: 'var(--chip)' }} />
              <div className="skeleton-line" style={{ width: '40%', height: 14, marginTop: 8, background: 'var(--chip)' }} />
              <div className="skeleton-line" style={{ width: '50%', height: 14, marginTop: 8, background: 'var(--chip)' }} />
            </div>
          </div>
        )}

        <AnimatePresence custom={exitDir}>
          {!loading && visibleRest.slice().reverse().map((c, i, arr) => {
            const depth = arr.length - i; // 1 = 2枚目
            return (
              <motion.div
                key={c.id}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden',
                  background: 'var(--card)', color: 'var(--text)', boxShadow: '0 10px 30px var(--elev)',
                  translateY: depth * 12, zIndex: 100 - depth, pointerEvents: 'none',
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 - depth * 0.04 }}
                exit={{ opacity: 0 }}
              >
                <div style={{ width: '100%', height: '60%' }}>
                  <AnimatedImage src={c.image} alt={c.name} variant="fade" />
                </div>
                <div style={{ padding: 14, opacity: 0.7 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{c.name}</h2>
                </div>
              </motion.div>
            );
          })}

          {top && !loading && (
            <SwipeableCard
              key={top.id}
              card={top}
              userPos={userPos}
              onTapImage={() => nextPhotoWithFetch(top.id)}
              onSwipeUp={() => openDetails(top.id, top.name)}
              onSwiped={(dir) => handleSwipe(top, dir)}
            />
          )}
        </AnimatePresence>

        {!top && !loading && renderEmptyState()}
      </div>

      {/* 操作ボタン（戻す / NOPE / 詳細 / LIKE） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 2 }}>
        <button onClick={undo} disabled={history.length === 0} aria-label="ひとつ戻す" title="ひとつ戻す（Backspace）"
          style={{ ...actionBtn('#f59e0b', 44), opacity: history.length === 0 ? 0.4 : 1 }}>↺</button>
        <button onClick={() => top && handleSwipe(top, 'left')} disabled={!top || loading} aria-label="見送る" title="見送る（←）"
          style={{ ...actionBtn('#ef4444'), opacity: !top || loading ? 0.4 : 1 }}>✕</button>
        <button onClick={() => top && openDetails(top.id, top.name)} disabled={!top || loading} aria-label="詳細" title="詳細（↑）"
          style={{ ...actionBtn('#3b82f6', 44), opacity: !top || loading ? 0.4 : 1 }}>i</button>
        <button onClick={() => top && handleSwipe(top, 'right')} disabled={!top || loading} aria-label="お気に入りに追加" title="お気に入り（→）"
          style={{ ...actionBtn('#10b981'), opacity: !top || loading ? 0.4 : 1 }}>♥</button>
      </div>

      {/* 残り件数 */}
      {stats && !loading && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -4 }}>
          残り {shownDeck.length}件{nextToken ? '＋' : ''}
          {deck.length !== shownDeck.length && `（絞り込みで${deck.length - shownDeck.length}件非表示）`}
          {loadingMore && ' ・続きを読み込み中…'}
          {stats.hidden > 0 && ` ・見送り/保存済み${stats.hidden}件を除外`}
        </div>
      )}

      </div>

      {/* ===== 保存済み（Googleマップの「保存済み」風） ===== */}
      <div
        style={{
          display: tab === 'saved' ? 'block' : 'none',
          maxWidth: 560, margin: '0 auto', padding: '16px 16px 24px', boxSizing: 'border-box',
        }}
      >
        <SavedView
          favorites={favorites}
          allTags={existingAllTags}
          tagCounts={tagCounts}
          userPos={userPos}
          seenCount={seenIds.length}
          onOpenDetails={openDetails}
          onEditTags={(ids) => setTagSheetIds(ids)}
          onDelete={deleteFavorite}
          onShare={shareFavorites}
          onShowOnMap={(tag) => { setMapTag(tag); selectTab('map'); }}
          onCreateTag={createTag}
          onManageTags={() => setTagManagerOpen(true)}
          onExport={exportBackup}
          onImport={importBackup}
          onResetSeen={resetSeen}
          onGoSearch={() => selectTab('search')}
        />
      </div>

      {/* ===== 地図 ===== */}
      {tab === 'map' && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 24px', boxSizing: 'border-box' }}>
          <h1 style={{ margin: '4px 2px 12px', fontSize: 24, fontWeight: 600 }}>地図</h1>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
              <Icon name="search" size={20} />
            </span>
            <input
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              enterKeyHint="search"
              placeholder="保存したお店をさがす（店名・エリア・タグ）"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 40px', borderRadius: 999,
                border: '1px solid var(--border)', background: 'var(--card)', fontSize: 16,
                boxShadow: '0 2px 6px var(--elev)',
              }}
            />
            {mapQuery && (
              <button
                onClick={() => setMapQuery('')}
                aria-label="入力を消す"
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
          <div className="hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
            <button onClick={() => setMapTag(null)} style={accentChip(effMapTag === null)}>すべて</button>
            {existingAllTags.map((t) => (
              <button key={t} onClick={() => setMapTag(t)} style={accentChip(effMapTag === t)}>{t}</button>
            ))}
          </div>
          <FavoritesMap
            items={mapItems}
            userPos={userPos}
            onOpenDetails={openDetailsById}
            height={`max(300px, calc(100dvh - ${NAV_HEIGHT + 245}px))`}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            {mapItems.length}件を表示
            {mapItems.length < mapFavorites.length && `（位置情報のない${mapFavorites.length - mapItems.length}件は表示できません）`}
          </div>
        </div>
      )}

      {/* ===== 下タブ ===== */}
      <nav
        aria-label="メインメニュー"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3000,
          background: 'var(--card)', borderTop: '1px solid var(--border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.4)',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto', height: NAV_HEIGHT, display: 'flex', justifyContent: 'center' }}>
          {([
            ['search', '探す', 'search'],
            ['saved', '保存済み', 'bookmark'],
            ['map', '地図', 'map'],
          ] as const).map(([key, label, icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => selectTab(key)}
                aria-current={active ? 'page' : undefined}
                style={{
                  flex: '0 0 112px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0,
                  background: 'transparent', border: 'none',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: active ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: 56, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'var(--accent-bg)' : 'transparent',
                  }}
                >
                  <Icon name={icon} size={22} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 詳細モーダル */}
      <DetailsModal open={detailsOpen} onClose={closeDetails} placeId={detailsPlaceId} fallbackName={detailsName} />

      {/* タグ編集シート（お店ごと・まとめて） */}
      {sheetFavs.length > 0 && (
        <TagSheet
          title={sheetFavs.length === 1 ? sheetFavs[0].name : `${sheetFavs.length}件のお店`}
          allTags={existingAllTags}
          activeTags={sheetActiveTags}
          onToggle={(t) => toggleTagOn(tagSheetIds, t)}
          onCreate={(t) => createTagOn(tagSheetIds, t)}
          onClose={() => setTagSheetIds([])}
        />
      )}

      {/* タグ管理（名前変更・削除） */}
      {tagManagerOpen && (
        <TagManager
          tags={existingAllTags}
          counts={tagCounts}
          onRename={renameTag}
          onDelete={deleteTag}
          onClose={() => setTagManagerOpen(false)}
        />
      )}

      {/* トースト */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: `calc(${NAV_OFFSET} + 12px)`,
              zIndex: 6000, display: 'flex', justifyContent: 'center', padding: '0 12px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16,
                width: 'fit-content', maxWidth: 'min(520px, 100%)', boxSizing: 'border-box',
                background: '#222', color: '#fff', borderRadius: 12, padding: '12px 16px',
                fontSize: 14, lineHeight: 1.4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              <span className="jp-text" style={{ flex: 1, minWidth: 0 }}>{toast.msg}</span>
              {toast.action && (
                <button
                  onClick={() => { toast.action?.(); setToast(null); }}
                  style={{ flex: '0 0 auto', background: 'transparent', border: 'none', color: '#8ab4f8', fontWeight: 700, whiteSpace: 'nowrap', padding: '4px 2px' }}
                >
                  {toast.actionLabel ?? '元に戻す'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* テーマCSS・スケルトンCSS */}
      <style>{`
        .skeleton-hero, .skeleton-line { animation: pulse 1.2s infinite ease-in-out; opacity:.6; }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </main>
  );
}
