
// app/api/places/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });

  // 位置バイアス（任意）
  const biasParams =
    lat && lng ? { location: `${lat},${lng}`, radius: '1500' } : {};

  const params = new URLSearchParams({
    query: q,
    language: 'ja',
    region: 'jp',
    key,
    ...biasParams,
  });

  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json?' +
    params.toString();

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // デバッグ（必要時だけ）
    console.log(
      'TextSearch status:',
      data?.status,
      'results:',
      data?.results?.length ?? 0
    );
    if (data?.error_message)
      console.warn('TextSearch error_message:', data.error_message);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const cards = (data.results ?? []).map((p: any) => {
      const photos = Array.isArray(p.photos) ? p.photos : [];
      return {
        placeId: p.place_id,
        name: p.name,
        address: p.formatted_address,
        rating: p.rating ?? null,
        userRatingsTotal: p.user_ratings_total ?? 0,
        openNow: p.opening_hours?.open_now ?? null,
        priceLevel: p.price_level ?? null,
        photoRef: photos[0]?.photo_reference ?? null,         // メイン
        photoRefs: photos.map((ph: any) => ph.photo_reference) ?? [], // ギャラリー用
        photosCount: photos.length ?? 0,
        lat: p.geometry?.location?.lat ?? null,
        lng: p.geometry?.location?.lng ?? null,
        types: p.types ?? [],
      };
    });

    return NextResponse.json({ cards, status: data.status ?? 'OK' });
  } catch (e) {
    console.error('TextSearch fetch_failed:', e);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
