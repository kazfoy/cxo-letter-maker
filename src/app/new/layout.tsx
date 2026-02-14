import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'レター作成 | CxO Letter Maker',
  description: 'AIを活用して、企業の決裁者（CxO）に響く高品質なセールスレターやイベント招待状を自動生成します。',
  alternates: {
    canonical: 'https://cxo-letter.jp/new',
  },
};

export default function NewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
