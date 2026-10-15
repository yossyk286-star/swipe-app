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

export type PlaceDetails = {
  name: string | null;
  address: string | null;
  website: string | null;
  mapUrl: string | null;
  phone: string | null;
  openingHours: { open_now?: boolean; weekday_text?: string[] } | null;
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

/** API の結果をカードに変換（写真のないお店は除外） */
export function toCards(raw: ApiPlace[]): PlaceCard[] {
  return raw
    .filter((p) => !!p.photoRef && !!p.placeId)
    .map((p) => ({
      id: p.placeId as string,
      name: p.name ?? '名称不明',
      image: photoUrl(p.photoRef as string),
      openNow: p.openNow ?? null,
      photosCount: typeof p.photosCount === 'number' ? p.photosCount : 1,
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
export const NAV_HEIGHT = 64;

/** 下タブ全体の高さ（CSS式）。余白を詰めた分を含む */
export const NAV_OFFSET = 'calc(64px + env(safe-area-inset-bottom) * 0.4)';

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
    const ref = f.photoRefs?.[f.currentIdx ?? 0] || f.photoRefs?.[0] || getRefFromImageUrl(f.image);
    const it: SharedItem = { n: f.name, p: f.id };
    if (ref) it.r = ref;
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
        out.push({ name: o.name, image: typeof o.image === 'string' ? o.image : null });
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
} as const;
