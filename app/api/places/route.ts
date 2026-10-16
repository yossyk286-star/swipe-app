// app/api/places/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '../_lib/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30; // 続きのページの再試行で待つぶん、長めに

// --- 型の簡易定義（必要なら拡張）
type GPhoto = { photo_reference: string };
type GResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  opening_hours?: { open_now?: boolean };
  types?: string[];
  photos?: GPhoto[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
};
type GResponse = {
  status: string;
  results?: GResult[];
  error_message?: string;
  next_page_token?: string;
};

function err(status: number, msg: string, extra: Record<string, unknown> = {}) {
  console.error('[places]', msg, extra);
  return NextResponse.json({ error: msg, ...extra }, { status });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  try {
    // 課金の悪用対策：他サイトからの呼び出し拒否＋IPごとの回数制限（1分20回）
    const blocked = guard(req, 'places', 20);
    if (blocked) return blocked;

    const u = new URL(req.url);
    const q = u.searchParams.get('q')?.trim() || '';
    const lat = u.searchParams.get('lat');
    const lng = u.searchParams.get('lng');
    // 続きのページを取るためのトークン（Googleが返す next_page_token）
    const pageToken = u.searchParams.get('pagetoken')?.trim() || '';

    if (!q && !pageToken) return err(400, 'missing_q');
    if (q.length > 100) return err(400, 'q_too_long');
    if (pageToken.length > 2000) return err(400, 'invalid_pagetoken');
    // 現在地は数字だけ受け付ける（変な値をそのままGoogleに渡さない）
    const latN = lat === null ? NaN : Number(lat);
    const lngN = lng === null ? NaN : Number(lng);
    const hasGeo = Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return err(500, 'missing_api_key');

    // ---- Google Places Text Search エンドポイント
    // ref: https://developers.google.com/maps/documentation/places/web-service/search-text
    const gUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    if (pageToken) {
      gUrl.searchParams.set('pagetoken', pageToken);
    } else {
      gUrl.searchParams.set('query', q);
      // 現在地があれば bias 用に location を付ける（rankby=prominence デフォルト）
      if (hasGeo) gUrl.searchParams.set('location', `${latN},${lngN}`);
    }
    gUrl.searchParams.set('language', 'ja');
    gUrl.searchParams.set('key', key);

    // --- 呼び出し（pagetoken は発行直後だと INVALID_REQUEST になることがあるので少し待って再試行）
    let gJson: GResponse | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const gRes = await fetch(gUrl.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      console.log('[places] upstream status', gRes.status);
      if (!gRes.ok) {
        // 相手の応答の中身はログにだけ残し、利用者には返さない
        console.error('[places] upstream body', (await gRes.text()).slice(0, 500));
        return err(502, 'google_upstream_not_ok', { status: gRes.status });
      }
      gJson = (await gRes.json()) as GResponse;
      if (pageToken && gJson.status === 'INVALID_REQUEST' && attempt < 3) {
        await sleep(1500);
        continue;
      }
      break;
    }

    if (!gJson) return err(502, 'google_empty_response');

    if (gJson.status !== 'OK' && gJson.status !== 'ZERO_RESULTS') {
      // 代表的には REQUEST_DENIED（キー制限・課金）、INVALID_REQUEST、OVER_QUERY_LIMIT 等
      return err(502, 'google_status_not_ok', { g_status: gJson.status, g_error: gJson.error_message });
    }

    const results = gJson.results || [];

    // --- フロント用に整形
    const cards = results.map((r) => {
      const photoRefs = (r.photos || []).map((p) => p.photo_reference).filter(Boolean);
      const firstRef = photoRefs[0];

      return {
        placeId: r.place_id,
        name: r.name,
        address: r.formatted_address ?? null,
        lat: r.geometry?.location?.lat ?? null,
        lng: r.geometry?.location?.lng ?? null,
        types: r.types ?? [],
        openNow: r.opening_hours?.open_now ?? null,
        rating: r.rating ?? null,
        userRatingsTotal: r.user_ratings_total ?? 0,
        priceLevel: r.price_level ?? null,

        // フロントが期待しているプロパティ
        photoRef: firstRef ?? null,
        photoRefs,
        photosCount: photoRefs.length,
      };
    });

    return NextResponse.json({ cards, nextPageToken: gJson.next_page_token ?? null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[places] exception', e);
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return err(504, 'upstream_timeout');
    return err(500, 'exception');
  }
}
