import { NextResponse } from 'next/server';

const BASE = 'https://hanokbbq.com.au/wp-content/uploads/2021/02/';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
    return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
  }
  try {
    const upstream = await fetch(BASE + file, {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      next: { revalidate: 86400 }
    });
    if (!upstream.ok) return NextResponse.json({ error: 'Image unavailable' }, { status: 404 });
    const body = await upstream.arrayBuffer();
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
      }
    });
  } catch {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 502 });
  }
}
