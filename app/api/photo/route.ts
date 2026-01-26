// app/api/photo/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');            // クライアントからは「生のref」を受け取る想定（※二重エンコード回避）
  const maxwidth = searchParams.get('maxwidth') ?? '1200';

  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'missing api key' }, { status: 500 });
  }

  // ✅ URL/URLSearchParams で安全に組み立て（& ← 正しい区切り、&amp; は使わない）
  const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
  googleUrl.search = new URLSearchParams({
    maxwidth,
    photo_reference: ref,  // ここで自動的に1回だけエンコードされる
    key,
  }).toString();

  try {
    // Place Photo API は 302 で実画像へリダイレクトするため follow が必要
    const upstream = await fetch(googleUrl.toString(), { redirect: 'follow', cache: 'no-store' });

    if (!upstream.ok || !upstream.body) {
      console.error('Photo fetch failed:', upstream.status, await safeText(upstream));
      return NextResponse.json({ error: 'photo_fetch_failed' }, { status: 500 });
    }

    // 画像をストリームでそのまま返す（不要なメモリ消費を避ける）
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const res = new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        // ブラウザ/Edgeでキャッシュ可能（必要に応じて調整）
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
    return res;
  } catch (e) {
    console.error('Photo proxy exception:', e);
    return NextResponse.json({ error: 'exception' }, { status: 500 });
  }
}

// エラーログ用に本文の一部だけ読む（テキストっぽい時のみ）
async function safeText(res: Response) {
  try {
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json') && !type.includes('text')) return '';
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return '';
  }
}