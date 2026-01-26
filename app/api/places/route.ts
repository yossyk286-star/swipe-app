// app/api/places/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function err(status: number, msg: string, extra: Record<string, unknown> = {}) {
  console.error('[places]', msg, extra);
  return NextResponse.json({ error: msg, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const q = u.searchParams.get('q')?.trim() || '';
    const lat = u.searchParams.get('lat');
    const lng = u.searchParams.get('lng');

    if (!q) return err(400, 'missing_q');

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return err(500, 'missing_api_key');

    // ---- Google Places Text Search エンドポイント
    // ref: https://developers.google.com/maps/documentation/places/web-service/search-text
    // fields は Details で取得する想定が多いが、TextSearch でも基本情報は返る
    const gUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    gUrl.searchParams.set('query', q);
    // 現在地があれば bias 用に location を付ける（rankby=prominence デフォルト）
    if (lat && lng) gUrl.searchParams.set('location', `${lat},${lng}`);
    gUrl.searchParams.set('language', 'ja');
    gUrl.searchParams.set('key', key);

    // --- 呼び出し
    const gRes = await fetch(gUrl.toString(), { cache: 'no-store' });
    const gTextHead = (await gRes.clone().text()).slice(0, 500); // ログ用ヘッド
    console.log('[places] upstream status', gRes.status);
    if (!gRes.ok) {
      return err(502, 'google_upstream_not_ok', { status: gRes.status, head: gTextHead });
    }
    const gJson = JSON.parse(gTextHead + (await gRes.text()).slice(500)) as {
      status: string;
      results?: GResult[];
      error_message?: string;
    };

    if (gJson.status !== 'OK' && gJson.status !== 'ZERO_RESULTS') {
      // 代表的には REQUEST_DENIED（キー制限）、INVALID_REQUEST、OVER_QUERY_LIMIT 等
      return err(502, 'google_status_not_ok', { g_status: gJson.status, g_error: gJson.error_message });
    }

    const results = (gJson.results || []) as GResult[];

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

    // 必要なら件数制限（フロント側でも slice しているので省略可）
    // const limited = cards.slice(0, 60);

    return NextResponse.json({ cards });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('[places] exception', e);
    return err(500, 'exception');
  }
}