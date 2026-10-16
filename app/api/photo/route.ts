// app/api/photo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '../_lib/guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 課金の悪用対策：他サイトからの読み込み拒否＋IPごとの回数制限（1分300回）
  const blocked = guard(req, 'photo', 300);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');            // クライアントからは「生のref」を受け取る想定（※二重エンコード回避）

  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 });
  }
  // 明らかに不正な値は Google に投げない
  if (ref.length > 2000) {
    return NextResponse.json({ error: 'invalid ref' }, { status: 400 });
  }

  // 幅は 100〜1600 に丸める（巨大サイズの要求を防ぐ）
  const rawWidth = Number.parseInt(searchParams.get('maxwidth') ?? '1200', 10);
  const maxwidth = String(Number.isFinite(rawWidth) ? Math.min(1600, Math.max(100, rawWidth)) : 1200);

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
    const upstream = await fetch(googleUrl.toString(), { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(10000) });

    if (!upstream.ok || !upstream.body) {
      console.error('Photo fetch failed:', upstream.status, await safeText(upstream));
      return NextResponse.json({ error: 'photo_fetch_failed' }, { status: 500 });
    }

    // 画像をストリームでそのまま返す（不要なメモリ消費を避ける）
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const res = new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        // 同じ写真への再リクエスト（＝課金）を減らすため、ブラウザ/Edgeで30日キャッシュ
        // （同じ写真の参照＋同じ幅なら、中身は変わらないので長く持っても安全）
        'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400, immutable',
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
