// app/lib/swipick.ts
// 画面間で共有する型とヘルパ

/** ------------ 型 ------------ */
export type LatLng = { lat: number; lng: number };

export type PlaceCard = {
  id: string;
  name: string;
  image: string; // /api/photo?ref=...
  openNow: boolean | null;
  photosCount: number;
  photoRefs: string[];
  currentIdx?: number;
  address?: string | null;
  types: string[];
  lat: number | null;
  lng: number | null;
  rating?: number | null;
  userRatingsTotal?: number;
  priceLevel?: number | null;
};

export type Favorite = PlaceCard & { tags: string[]; addedAt?: number };

/** Google の営業時間（day: 0=日曜〜6=土曜、time: 'HHMM'） */
export type OpeningPeriod = {
  open?: { day: number; time?: string };
  close?: { day: number; time?: string };
};

export type PlaceDetails = {
  name: string | null;
  address: string | null;
  website: string | null;
  mapUrl: string | null;
  phone: string | null;
  openingHours: { open_now?: boolean; weekday_text?: string[]; periods?: OpeningPeriod[] } | null;
  types: string[];
  rating: number | null;
  userRatingsTotal: number;
  priceLevel: number | null;
  photoRefs: string[];
  lat: number | null;
  lng: number | null;
};

/** /api/places が返すカード（サーバー側の整形結果） */
export type ApiPlace = {
  placeId?: string;
  name?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  types?: string[];
  openNow?: boolean | null;
  rating?: number | null;
  userRatingsTotal?: number;
  priceLevel?: number | null;
  photoRef?: string | null;
  photoRefs?: string[];
  photosCount?: number;
};

/** ------------ 写真 ------------ */
export const photoUrl = (ref: string, max = 800) =>
  `/api/photo?${new URLSearchParams({ ref, maxwidth: String(max) }).toString()}`;

export const getRefFromImageUrl = (u: string) => {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(u, base).searchParams.get('ref') ?? '';
  } catch {
    return '';
  }
};

/** API の結果をカードに変換（既定では写真のないお店は除外） */
export function toCards(raw: ApiPlace[], includeNoPhoto = false): PlaceCard[] {
  return raw
    .filter((p) => !!p.placeId && (includeNoPhoto || !!p.photoRef))
    .map((p) => ({
      id: p.placeId as string,
      name: p.name ?? '名称不明',
      image: p.photoRef ? photoUrl(p.photoRef) : '',
      openNow: p.openNow ?? null,
      photosCount: typeof p.photosCount === 'number' ? p.photosCount : p.photoRef ? 1 : 0,
      photoRefs: p.photoRefs ?? [],
      currentIdx: 0,
      address: p.address ?? null,
      types: p.types ?? [],
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      rating: p.rating ?? null,
      userRatingsTotal: p.userRatingsTotal ?? 0,
      priceLevel: p.priceLevel ?? null,
    }));
}

/** タグのアイコンとして選べる絵文字 */
export const TAG_ICON_CHOICES = [
  '🍺', '🍻', '🍷', '🍸', '🥂', '☕', '🍵', '🍰',
  '🍜', '🍣', '🍖', '🍕', '🍔', '🍙', '🥗', '🍱',
  '🍢', '🦐', '🥩', '🍛', '🌶️', '🍨', '🎂', '🍩',
  '❤️', '⭐', '🔥', '🎉', '💼', '👫', '🏠', '📌',
] as const;

/** ------------ 営業時間の目印 ------------ */
const hhmm = (t: string) => `${Number(t.slice(0, 2))}:${t.slice(2, 4)}`;
const toMin = (day: number, t: string) => day * 1440 + Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4));
const WEEK = 7 * 1440;

/**
 * 「あと◯分で閉店」「◯時に開店」などの目印を作る。営業時間のデータ（periods）がなければ null。
 * 時刻は端末の現在時刻で計算する（日本のお店を日本で見る前提）。
 */
export function hoursStatus(
  oh: { open_now?: boolean; periods?: OpeningPeriod[] } | null | undefined,
  now: Date = new Date()
): { text: string; tone: 'open' | 'soon' | 'closed' } | null {
  const periods = oh?.periods;
  if (!oh || !Array.isArray(periods) || periods.length === 0) return null;
  // 24時間営業（day0・0000オープンでcloseなし）
  if (periods.length === 1 && periods[0].open && !periods[0].close) return { text: '24時間営業', tone: 'open' };

  const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  type R = { start: number; end: number; closeT: string; openT: string };
  const ranges: R[] = [];
  for (const p of periods) {
    if (!p.open?.time || !p.close?.time || typeof p.open.day !== 'number' || typeof p.close.day !== 'number') continue;
    const start = toMin(p.open.day, p.open.time);
    let end = toMin(p.close.day, p.close.time);
    if (end <= start) end += WEEK;
    ranges.push({ start, end, closeT: p.close.time, openT: p.open.time });
  }
  if (ranges.length === 0) return null;

  // いま営業している区間（週をまたぐ分も見る）
  for (const r of ranges) {
    for (const off of [0, WEEK]) {
      const s = r.start - off;
      const e = r.end - off;
      if (nowMin >= s && nowMin < e) {
        const left = e - nowMin;
        const closeLabel = hhmm(r.closeT);
        if (left <= 90) return { text: `あと${left}分で閉店（${closeLabel}）`, tone: left <= 30 ? 'soon' : 'open' };
        return { text: `${closeLabel}まで営業`, tone: 'open' };
      }
    }
  }
  // 次に開く時刻
  let best: { wait: number; openT: string; day: number } | null = null;
  for (const r of ranges) {
    let wait = (r.start - nowMin + WEEK) % WEEK;
    if (wait === 0) wait = WEEK;
    if (!best || wait < best.wait) best = { wait, openT: r.openT, day: Math.floor((nowMin + wait) / 1440) % 7 };
  }
  if (!best) return null;
  const todayDay = now.getDay();
  const label = best.day === todayDay && best.wait < 1440 ? '' : best.day === (todayDay + 1) % 7 && best.wait < 2880 ? '明日の' : `${['日', '月', '火', '水', '木', '金', '土'][best.day]}曜の`;
  return { text: `${label}${hhmm(best.openT)}に開店`, tone: 'closed' };
}

/** ------------ 距離 ------------ */
export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function distanceTo(pos: LatLng | null, lat: number | null, lng: number | null) {
  if (!pos || lat == null || lng == null) return null;
  return haversineMeters(pos, { lat, lng });
}

export function formatDistance(m: number | null | undefined) {
  if (m == null) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** ------------ 表示用 ------------ */
export function priceLabel(level: number | null | undefined) {
  if (level == null) return null;
  // Google の価格帯は4段階しかないため、おおよその金額（1人あたり）に置き換えて表示する
  if (level === 0) return '無料';
  if (level === 1) return '〜1,000円';
  if (level === 2) return '1,000〜3,000円';
  if (level === 3) return '3,000〜6,000円';
  return '6,000円〜';
}

export function formatCount(n: number | null | undefined) {
  return (n ?? 0).toLocaleString('ja-JP');
}

/** Google の types からカテゴリ名を作る（上にあるものほど優先） */
const TYPE_LABELS: [string, string][] = [
  ['cafe', 'カフェ'],
  ['bar', 'バー'],
  ['night_club', 'ナイトクラブ'],
  ['bakery', 'ベーカリー'],
  ['meal_takeaway', 'テイクアウト'],
  ['meal_delivery', 'デリバリー'],
  ['restaurant', 'レストラン'],
  ['food', '飲食店'],
  ['lodging', '宿泊施設'],
  ['tourist_attraction', '観光スポット'],
  ['park', '公園'],
  ['store', '店舗'],
];

export function typeLabel(types: string[] | undefined): string | null {
  if (!types) return null;
  for (const [key, label] of TYPE_LABELS) {
    if (types.includes(key)) return label;
  }
  return null;
}

/** 住所から「日本、」と郵便番号を取り除いて短くする */
export function shortAddress(a: string | null | undefined): string {
  if (!a) return '';
  return a
    .replace(/^日本、\s*/, '')
    .replace(/^〒\s*[0-9０-９]{3}[-－ー]?[0-9０-９]{4}\s*/, '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u2212/g, '-')
    .replace(/\u3000/g, ' ')
    .trim();
}

/** 下タブの高さ（px）。固定バーやトーストの位置合わせに使う */
export const NAV_HEIGHT = 56;

/** 下タブ全体の高さ（CSS式）。余白を詰めた分を含む */
export const NAV_OFFSET = 'calc(56px + env(safe-area-inset-bottom) * 0.4)';

/** ------------ Googleマップへのリンク ------------ */
export function mapsPlaceUrl(name: string, placeId?: string) {
  const p = new URLSearchParams({ api: '1', query: name });
  if (placeId) p.set('query_place_id', placeId);
  return `https://www.google.com/maps/search/?${p.toString()}`;
}

export function mapsDirectionsUrl(name: string, placeId?: string) {
  const p = new URLSearchParams({ api: '1', destination: name });
  if (placeId) p.set('destination_place_id', placeId);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

/** ------------ 検索エラーの説明 ------------ */
export function searchErrorMessage(
  status: number,
  body: { error?: string; g_status?: string; g_error?: string } | null
): { message: string; detail?: string } {
  const code = body?.error;
  if (status === 429 || code === 'rate_limited') {
    return { message: '短時間に検索しすぎています。1分ほど待ってから、もう一度お試しください。' };
  }
  if (code === 'missing_api_key') {
    return {
      message: 'サーバーにAPIキーが設定されていません。',
      detail: '管理者向け：Vercel の環境変数 GOOGLE_MAPS_API_KEY を確認し、再デプロイしてください。',
    };
  }
  if (code === 'google_status_not_ok') {
    switch (body?.g_status) {
      case 'REQUEST_DENIED':
        return {
          message: 'Google にリクエストを拒否されました。',
          detail: `課金設定・Places API の有効化・APIキーの制限を確認してください。${body?.g_error ? `（${body.g_error}）` : ''}`,
        };
      case 'OVER_QUERY_LIMIT':
        return { message: 'Google の利用上限に達しました。時間をおいて再度お試しください。' };
      case 'INVALID_REQUEST':
        return { message: '検索条件が正しくありません。キーワードを変えてお試しください。' };
      default:
        return { message: '検索に失敗しました。', detail: `Google の応答：${body?.g_status ?? '不明'}` };
    }
  }
  if (status === 403) return { message: 'アクセスが拒否されました。ページを開き直してください。' };
  if (code === 'q_too_long') return { message: 'キーワードが長すぎます。短くしてお試しください。' };
  return { message: '検索に失敗しました。', detail: `エラー：${code ?? `HTTP ${status}`}` };
}

/** ------------ 共有リンク ------------ */
/** 共有データ（URLを短くするため1文字キー）。旧形式 {name, image} も読めるようにする */
export type SharedItem = { n: string; p?: string; r?: string; a?: [number, number] };
export type SharedView = { name: string; image: string | null; placeId?: string; lat?: number; lng?: number; ref?: string };

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShare(favs: Favorite[]): string {
  const items: SharedItem[] = favs.map((f) => {
    // 写真の情報（refはとても長い）は入れない。受け取った側のページで、見える分だけ後から取得する
    const it: SharedItem = { n: f.name, p: f.id };
    if (f.lat != null && f.lng != null) it.a = [Math.round(f.lat * 1e5) / 1e5, Math.round(f.lng * 1e5) / 1e5];
    return it;
  });
  return toBase64Url(JSON.stringify(items));
}

export function decodeShare(payload: string): SharedView[] {
  if (!payload) return [];
  try {
    const arr: unknown = JSON.parse(fromBase64Url(payload));
    if (!Array.isArray(arr)) return [];
    const out: SharedView[] = [];
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      if (typeof o.n === 'string') {
        const ref = typeof o.r === 'string' ? o.r : undefined;
        const a = Array.isArray(o.a) && o.a.length === 2 && o.a.every((v) => typeof v === 'number') ? (o.a as [number, number]) : null;
        out.push({
          name: o.n,
          image: ref ? photoUrl(ref, 600) : null,
          placeId: typeof o.p === 'string' ? o.p : undefined,
          ref,
          lat: a?.[0],
          lng: a?.[1],
        });
      } else if (typeof o.name === 'string') {
        // 旧形式
        // 外部の画像URLは読み込まない（自分のサーバーの写真だけ許可）
        out.push({ name: o.name, image: typeof o.image === 'string' && o.image.startsWith('/api/photo?') ? o.image : null });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** ------------ ローカル保存キー（共有ページからの追加でも使う） ------------ */
export const STORAGE_KEYS = {
  favorites: 'favorites_v8',
  tags: 'user_tags_global',
  seen: 'seen_ids_v1',
  filters: 'filters_v1',
  theme: 'theme',
  accent: 'accent_v1',
  prefs: 'prefs_v1',
  tagIcons: 'tag_icons_v1',
} as const;
