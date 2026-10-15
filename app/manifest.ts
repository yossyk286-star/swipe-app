// app/manifest.ts — ホーム画面に追加したときの名前・アイコン・表示方法
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Swipick',
    short_name: 'Swipick',
    description: 'スワイプでお店を探して、お気に入りに保存',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111111',
    theme_color: '#111111',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
