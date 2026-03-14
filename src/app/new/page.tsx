'use client';

import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { useUiStore } from '@/stores/uiStore';
import { useInitialize } from './_components/useInitialize';
import { ModeSelector } from './_components/ModeSelector';
import { GuestBanner } from './_components/GuestBanner';
import { HistorySidebarWrapper } from './_components/HistorySidebarWrapper';
import { FormSection } from './_components/FormSection';
import { ResultSection } from './_components/ResultSection';
import { LimitGuard } from './_components/LimitGuard';
import { AnalysisModalWrapper } from './_components/AnalysisModalWrapper';

function NewLetterPageContent() {
  useInitialize();
  const isSidebarOpen = useUiStore((s) => s.isSidebarOpen);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <ModeSelector />
      <GuestBanner />

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
            {/* 左側: 履歴サイドバー */}
            <HistorySidebarWrapper />

            {/* 中央: 入力フォーム */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} transition-all duration-300`}>
              <FormSection />
            </div>

            {/* 右側: プレビューエリア */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10 transition-all duration-300`}>
              <ResultSection />
            </div>
          </div>
        </div>
      </main>

      <LimitGuard />
      <AnalysisModalWrapper />
    </div>
  );
}

export default function NewLetterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
            <p className="text-slate-600">読み込み中...</p>
          </div>
        </div>
      }
    >
      <NewLetterPageContent />
    </Suspense>
  );
}
