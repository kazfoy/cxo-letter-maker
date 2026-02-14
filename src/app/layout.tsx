import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cxo-letter.jp'),
  title: "CxO Letter Maker | 決裁者へ響く手紙をAIで作成",
  description: "AIを活用して、企業の決裁者（CxO）に響く高品質なセールスレターやイベント招待状を自動生成。営業効率を劇的に向上させます。",
  keywords: [
    "手紙作成",
    "AI",
    "営業",
    "CxO",
    "セールスレター",
    "BtoB営業",
    "決裁者",
    "アポ獲得",
    "営業効率化",
    "企業分析",
    "招待状作成",
    "イベント集客",
    "展示会フォロー",
    "営業レター",
    "自動生成"
  ],
  authors: [{ name: "CxO Letter Maker" }],
  creator: "CxO Letter Maker",
  publisher: "CxO Letter Maker",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://cxo-letter.jp",
    title: "CxO Letter Maker | 決裁者へ響く手紙をAIで作成",
    description: "AIを活用して、企業の決裁者（CxO）に響く高品質なセールスレターやイベント招待状を自動生成。営業効率を劇的に向上させます。",
    siteName: "CxO Letter Maker",
  },
  twitter: {
    card: "summary_large_image",
    title: "CxO Letter Maker | 決裁者へ響く手紙をAIで作成",
    description: "AIを活用して、企業の決裁者（CxO）に響く高品質なセールスレターやイベント招待状を自動生成。営業効率を劇的に向上させます。",
  },
  alternates: {
    canonical: 'https://cxo-letter.jp',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${notoSerifJP.variable} ${inter.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
