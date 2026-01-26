
// app/api/details/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get('placeId');
  if (!placeId) return NextResponse.json({ error: 'missing placeId' }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });

  // 取得するフィールドを最小限に
  const fields = [
    'name',
    'formatted_address',
    'geometry',
    'opening_hours',
    'website',
    'formatted_phone_number',
    'international_phone_number',
    'url',
    'types',
    'rating',
    'user_ratings_total',
    'price_level',
    'photos', // 追加の写真が欲しければ
  ].join(',');

  const params = new URLSearchParams({
    place_id: placeId,
    language: 'ja',
    region: 'jp',
    fields,
    key,
  });

  const url =
    'https://maps.googleapis.com/maps/api/place/details/json?' +
    params.toString();

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const r = data.result ?? {};
    const photos = Array.isArray(r.photos) ? r.photos : [];

    const details = {
      name: r.name ?? null,
      address: r.formatted_address ?? null,
      website: r.website ?? null,
      mapUrl: r.url ?? null,
      phone: r.formatted_phone_number ?? r.international_phone_number ?? null,
      openingHours: r.opening_hours ?? null, // { open_now, periods, weekday_text }
      types: r.types ?? [],
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? 0,
      priceLevel: r.price_level ?? null,
      photoRefs: photos.map((ph: any) => ph.photo_reference) ?? [],
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    };

    return NextResponse.json({ details, status: data.status ?? 'OK' });
  } catch (e) {
    console.error('Details fetch_failed:', e);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
