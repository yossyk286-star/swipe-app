import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Swipick",
  description: "スワイプでお店を探して、お気に入りに保存",
  applicationName: "Swipick",
  // iPhone で「ホーム画面に追加」したときにアプリのように全画面で開く
  appleWebApp: {
    capable: true,
    title: "Swipick",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 入力欄タップ時の自動ズームを防ぐ（iOS はピンチでの拡大は引き続き可能）
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 保存済みのテーマ設定を、画面が描かれる前に反映（ちらつき防止） */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=(localStorage.getItem('theme')||'').replace(/\"/g,'');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
