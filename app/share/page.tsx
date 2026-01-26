
// app/share/page.tsx
import { Suspense } from 'react';
import ShareClient from './ShareClient';

// /share を常に動的レンダリング（静的プリレンダー時のエラーを避ける）
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <ShareClient />
    </Suspense>
  );
}
