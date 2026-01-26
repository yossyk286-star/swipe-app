
// app/api/photo/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  const maxwidth = searchParams.get('maxwidth') ?? '1200';

  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'missing api key' }, { status: 500 });
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxwidth}` +
    `&photo_reference=${encodeURIComponent(ref)}` +
    `&key=${key}`;

  try {
    const upstream = await fetch(url, { redirect: 'follow', cache: 'no-store' });
    if (!upstream.ok) {
      console.error('Photo fetch failed:', upstream.status);
      return NextResponse.json({ error: 'photo_fetch_failed' }, { status: 500 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const buf = await upstream.arrayBuffer();

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'exception' }, { status: 500 });
  }
}
