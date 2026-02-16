'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useCheckout } from '@/hooks/useCheckout';
import { PlanSelectionModal } from '@/components/PlanSelectionModal';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const { isPro, isPremium, isTrialing, trialDaysRemaining, loading: planLoading } = useUserPlan();
  useCheckout(); // Hook for potential upgrade functionality

  // LPページかどうかを判定（トップページのみLP扱い）
  const isLandingPage = pathname === '/';

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // LP用Header（未ログイン時）
  if (!user && isLandingPage) {
    return (
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* ロゴ */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-black tracking-tight text-stone-900">
                CxO Letter Maker
              </h1>
            </Link>

            {/* ナビゲーション */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-stone-600 hover:text-amber-800 font-bold transition-colors">
                機能
              </a>
              <Link
                href="/login"
                className="px-6 py-2.5 text-stone-700 font-bold hover:text-amber-800 transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/new"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-700 to-amber-900 text-white rounded-full font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all"
              >
                無料で始める
              </Link>
            </nav>

            {/* モバイルメニュー */}
            <div className="md:hidden flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-stone-700 font-bold"
              >
                ログイン
              </Link>
              <Link
                href="/new"
                className="px-4 py-2 bg-amber-800 text-white rounded-full font-bold text-sm shadow-sm"
              >
                始める
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // アプリ用Header（ログイン時）
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* ロゴ */}
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">CxO Letter Maker</h1>
          </Link>

          <div className="flex items-center gap-4">
            {(!loading || !user) && (
              <>
                {user ? (
                  <>
                    {/* ログイン時のナビゲーション */}
                    <nav className="hidden md:flex items-center gap-4">
                      {/* プラン情報のローディング中は何も表示しない（FOUC防止） */}
                      {!planLoading && (
                        <>
                          {isPremium ? (
                            <span className="mr-2 px-3 py-1 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border border-amber-300 rounded-full font-bold text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              Premium
                            </span>
                          ) : isPro && isTrialing ? (
                            <span className="mr-2 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-300 rounded-full font-bold text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              トライアル残り{trialDaysRemaining}日
                            </span>
                          ) : isPro ? (
                            <span className="mr-2 px-3 py-1 bg-gradient-to-r from-amber-50 to-stone-50 text-amber-700 border border-amber-200 rounded-full font-bold text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pro Plan
                            </span>
                          ) : (
                            <button
                              onClick={() => setIsUpgradeModalOpen(true)}
                              className="mr-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-full font-bold text-sm hover:from-amber-700 hover:to-amber-800 transition-all shadow-sm flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              プランをアップグレード
                            </button>
                          )}
                        </>
                      )}
                      <Link
                        href="/dashboard/history"
                        className="px-4 py-2 text-stone-700 hover:text-stone-900 font-medium transition-colors"
                      >
                        履歴一覧
                      </Link>
                      <Link
                        href="/bulk"
                        className="px-4 py-2 text-stone-700 hover:text-stone-900 font-medium transition-colors"
                      >
                        一括生成
                      </Link>
                      <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-white text-stone-700 border border-stone-200 rounded-md font-medium hover:bg-stone-50 transition-all shadow-sm flex items-center gap-2"
                      >
                        ダッシュボードへ移動
                      </Link>
                    </nav>

                    {/* ユーザーメニュー */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-stone-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-stone-700" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-left hidden sm:block">
                          <p className="text-xs text-stone-500">ログイン中</p>
                          <p className="text-sm font-medium text-stone-900">{user.email}</p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-stone-700 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* ドロップダウンメニュー */}
                      {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-stone-200 py-1 z-50">
                          <div className="px-4 py-2 border-b border-stone-100">
                            <p className="text-xs text-stone-500">ログイン中</p>
                            <p className="text-sm font-medium text-stone-900 truncate">{user.email}</p>
                          </div>

                          <Link
                            href="/dashboard"
                            onClick={() => setIsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              ダッシュボード
                            </div>
                          </Link>

                          <Link
                            href="/dashboard/settings"
                            onClick={() => setIsDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              設定
                            </div>
                          </Link>

                          <hr className="my-1 border-stone-100" />

                          <button
                            onClick={() => {
                              setIsDropdownOpen(false);
                              signOut();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              ログアウト
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="px-4 py-2 text-stone-700 font-medium hover:text-stone-900 transition-colors"
                    >
                      ログイン
                    </Link>
                    <Link
                      href="/login"
                      className="px-4 py-2 bg-amber-800 text-white rounded-md font-bold hover:bg-amber-900 transition-colors text-sm shadow-sm"
                    >
                      無料で登録
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <PlanSelectionModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </header>
  );
}
