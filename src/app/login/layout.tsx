import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ログイン | CxO Letter Maker',
  description: 'CxO Letter Makerにログインして、レター作成・管理機能をご利用ください。',
  alternates: {
    canonical: 'https://cxo-letter.jp/login',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
