// app/api/_lib/guard.ts
// APIキー課金の悪用を防ぐ簡易ガード（他サイトからの呼び出し拒否＋IPごとの回数制限）。
// 注意: 回数制限はサーバーレス各インスタンスのメモリ上で数えるため「ベストエフォート」。
//       本格的に守るなら Vercel の Firewall / Rate Limiting や Upstash 等の外部ストアを使う。
import { NextRequest, NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * 問題があれば、そのまま返すレスポンスを返す。問題なければ null。
 * - 他サイト（cross-site）からの読み込み（<img>の直リンク等）は拒否
 * - アドレスバー直打ち（none）や自サイト（same-origin / same-site）は許可
 * - 同じIPから1分間に limitPerMinute 回を超えたら 429
 */
export function guard(req: NextRequest, name: string, limitPerMinute: number): NextResponse | null {
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const key = `${name}:${clientIp(req)}`;
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else {
    b.count += 1;
    if (b.count > limitPerMinute) {
      const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(retry) } }
      );
    }
  }

  // 期限切れのエントリを掃除（メモリ肥大防止）
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }
  return null;
}
