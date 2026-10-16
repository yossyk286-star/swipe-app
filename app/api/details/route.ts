
// app/api/details/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '../_lib/guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 課金の悪用対策：他サイトからの呼び出し拒否＋IPごとの回数制限（1分40回）
  const { searchParams } = new URL(req.url);
  // lite=1：写真の情報だけ取る軽い版（共有ページが、見えているお店の写真を後から取るために使う）
  const lite = searchParams.get('lite') === '1';
  const blocked = lite ? guard(req, 'details_lite', 90) : guard(req, 'details', 40);
  if (blocked) return blocked;

  const placeId = searchParams.get('placeId');
  if (!placeId) return NextResponse.json({ error: 'missing placeId' }, { status: 400 });
  if (placeId.length > 300) return NextResponse.json({ error: 'invalid placeId' }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });

  // 取得するフィールドを最小限に
  const fields = lite ? 'photos' : [
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
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Google が「OK」以外（キー制限・上限超過など）を返したら、空の情報を成功扱いにしない
    if (data.status && data.status !== 'OK') {
      console.error('Details google status:', data.status, data.error_message);
      return NextResponse.json({ error: 'google_status_not_ok', g_status: data.status }, { status: 502 });
    }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      photoRefs: photos.map((ph: any) => ph.photo_reference).filter((x: unknown) => typeof x === 'string' && x),
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    };

    return NextResponse.json({ details, status: data.status ?? 'OK' });
  } catch (e) {
    console.error('Details fetch_failed:', e);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
