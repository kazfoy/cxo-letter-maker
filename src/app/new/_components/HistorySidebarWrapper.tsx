'use client';

import { HistorySidebar } from '@/components/HistorySidebar';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';
import { useLetterActions } from './useLetterActions';

export function HistorySidebarWrapper() {
  const { currentLetterId, restoreFromHistory } = useLetterStore();
  const { isSidebarOpen, setIsSidebarOpen, refreshHistoryTrigger } = useUiStore();
  const { handleSampleExperience } = useLetterActions();

  return (
    <>
      {/* モバイル用背景オーバーレイ */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="サイドバーを閉じる"
        />
      )}

      <div
        className={`
          fixed md:relative top-0 left-0 h-full md:h-auto
          md:col-span-2 md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto
          bg-slate-50 md:bg-transparent z-50 md:z-10
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${!isSidebarOpen ? 'md:hidden' : ''}
          w-[85vw] max-w-xs md:w-auto
        `}
      >
        <HistorySidebar
          onRestore={restoreFromHistory}
          onSampleExperience={handleSampleExperience}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          refreshTrigger={refreshHistoryTrigger}
          selectedId={currentLetterId}
        />
      </div>
    </>
  );
}
