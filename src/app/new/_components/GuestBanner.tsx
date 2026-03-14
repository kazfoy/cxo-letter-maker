'use client';

import Link from 'next/link';
import { useLetterStore } from '@/stores/letterStore';
import { useLetterActions } from './useLetterActions';

export function GuestBanner() {
  const isDemoMode = useLetterStore((s) => s.isDemoMode);
  const { user, usage, handleExitDemo } = useLetterActions();

  if (user && !isDemoMode) return null;

  return (
    <>
      {/* ゲスト利用制限インジケーター */}
      {!user && usage && (
        <div className="bg-amber-50 border-b border-amber-200 py-2">
          <div className="container mx-auto px-4 flex justify-center items-center gap-2 text-sm text-amber-900">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              ゲスト利用中：本日あと <span className="font-bold text-lg">{usage.remaining}</span> 回
            </span>
            {usage.isLimitReached ? (
              <Link href="/login" className="ml-2 underline font-bold hover:text-amber-700">
                ログインして制限を解除
              </Link>
            ) : (
              <Link href="/login" className="ml-2 text-amber-800 hover:text-amber-900 font-medium">
                無料登録で10回/日に増やす &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* デモモードバナー */}
      {isDemoMode && (
        <div className="bg-amber-100 border-b border-amber-300 py-2.5">
          <div className="container mx-auto px-4 flex justify-center items-center gap-3 text-sm text-amber-900">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">デモモードで実行中</span>
            <span className="text-amber-700">|</span>
            <button
              onClick={handleExitDemo}
              className="font-bold text-amber-800 underline hover:text-amber-900 transition-colors"
            >
              自分の情報で試す
            </button>
          </div>
        </div>
      )}
    </>
  );
}
