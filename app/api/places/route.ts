
// app/api/places/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 検索APIは毎回実行（キャッシュしない）
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat'); // string | null
  const lng = searchParams.get('lng'); // string | null

  if (!q) {
    return NextResponse.json({ error: 'missing q' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });
  }

  // --- URLSearchParams に渡す前に、常に Record<string, string> を作る ---
  const paramsObj: Record<string, string> = {
    query: q,
    language: 'ja',
    region: 'jp',
    key,
  };

  // 位置バイアス（lat/lng が両方ある時だけ追加）
  if (lat && lng) {
    paramsObj.location = `${lat},${lng}`;
    paramsObj.radius = '1500';
  }

  const params = new URLSearchParams(paramsObj);

  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json?' +
    params.toString();

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'upstream_error', status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();

    const cards = (Array.isArray(data.results) ? data.results : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => {
        const photos = Array.isArray(p.photos) ? p.photos : [];
        return {
          placeId: p.place_id,
          name: p.name,
          address: p.formatted_address,
          rating: p.rating ?? null,
          userRatingsTotal: p.user_ratings_total ?? 0,
          openNow: p.opening_hours?.open_now ?? null,
          priceLevel: p.price_level ?? null,
          photoRef: photos[0]?.photo_reference ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          photoRefs: photos.map((ph: any) => ph.photo_reference) ?? [],
          photosCount: photos.length ?? 0,
          lat: p.geometry?.location?.lat ?? null,
          lng: p.geometry?.location?.lng ?? null,
          types: p.types ?? [],
        };
      }
    );

    return NextResponse.json({ cards, status: data.status ?? 'OK' });
  } catch (e) {
    console.error('TextSearch fetch_failed:', e);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
