'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export function Header() {
  const { user, signOut, loading } = useAuth();

  return (
    <header className="bg-navy-900 text-white shadow-md" style={{ backgroundColor: '#1e3a8a' }}>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CxO Letter Maker</h1>
            <p className="text-sm text-gray-200 mt-1">
              効果的な営業手紙作成ツール
            </p>
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="text-gray-200">ログイン中</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
                    >
                      ログアウト
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
                  >
                    ログイン
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
