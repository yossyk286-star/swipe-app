// app/lib/detailsCache.ts
// お店の詳細（Place Details）を端末に一定時間だけ保存して、同じお店を開き直したときに
// Google へ問い合わせ直さない（＝課金を減らす）ための保存。
// 保存先はこの端末のブラウザ内（localStorage）だけ。個人情報や位置情報は入らない。
import type { PlaceDetails } from './swipick';

const KEY = 'details_cache_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 1日（営業時間も一緒に取り直すため、全体を1日で入れ替える）
const MAX_ENTRIES = 200;            // 増え続けないよう、古いものから消す
const OPEN_NOW_FRESH_MS = 30 * 60 * 1000; // 営業時間データがないとき「営業中」を信じてよい時間

type Entry = { at: number; d: PlaceDetails };
type Store = Record<string, Entry>;

let store: Store | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Store {
  if (store) return store;
  store = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const now = Date.now();
        for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
          const e = v as Partial<Entry> | null;
          if (e && typeof e.at === 'number' && e.d && typeof e.d === 'object' && now - e.at < TTL_MS && e.at <= now + 60_000) {
            store[id] = { at: e.at, d: e.d as PlaceDetails };
          }
        }
      }
    }
  } catch {
    store = {};
  }
  return store;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = load();
    // 件数の上限：新しい順に残す
    const ids = Object.keys(s).sort((a, b) => s[b].at - s[a].at);
    for (const id of ids.slice(MAX_ENTRIES)) delete s[id];
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // 容量がいっぱいなど：半分に減らして1回だけやり直す。だめなら保存はあきらめる
      for (const id of ids.slice(Math.floor(ids.length / 2))) delete s[id];
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 保存できなくても動作には影響しない */ }
    }
  }, 500);
}

/** 保存してある詳細を返す（期限切れ・なければ null） */
export function getCachedDetails(placeId: string): PlaceDetails | null {
  const e = load()[placeId];
  if (!e) return null;
  if (Date.now() - e.at >= TTL_MS) {
    delete load()[placeId];
    return null;
  }
  const d = e.d;
  // 営業時間の表（periods）がないと「いま営業中か」を計算できない。古い「営業中」は信じない
  const oh = d.openingHours;
  if (oh && !(Array.isArray(oh.periods) && oh.periods.length > 0) && Date.now() - e.at > OPEN_NOW_FRESH_MS && 'open_now' in oh) {
    return { ...d, openingHours: { ...oh, open_now: undefined } };
  }
  return d;
}

export function setCachedDetails(placeId: string, d: PlaceDetails) {
  load()[placeId] = { at: Date.now(), d };
  scheduleSave();
}
