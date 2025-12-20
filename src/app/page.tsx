'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // ログイン済みユーザーは自動的に /dashboard へリダイレクト
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // ログイン済みユーザーの場合は何も表示しない（リダイレクト中）
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
          CxO Letter Maker
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 mb-12">
          LP準備中
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/login"
            className="px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-all shadow-md min-w-[200px]"
          >
            ログイン
          </Link>
          <Link
            href="/new"
            className="px-8 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-lg min-w-[200px]"
          >
            新規作成
          </Link>
        </div>
      </div>
    </div>
  );
}
