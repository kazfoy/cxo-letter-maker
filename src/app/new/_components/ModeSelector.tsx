'use client';

import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';

export function ModeSelector() {
  const { mode, setMode } = useLetterStore();
  const { isSidebarOpen, toggleSidebar } = useUiStore();

  return (
    <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleSidebar}
            className={`flex items-center gap-2 px-3 sm:px-4 py-3 rounded-md transition-all font-medium ${
              isSidebarOpen
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            aria-label={isSidebarOpen ? '履歴を閉じる' : '履歴を開く'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="hidden sm:inline">履歴</span>
          </button>

          <div className="flex gap-1 flex-1">
            <button
              onClick={() => setMode('sales')}
              className={`flex-1 px-3 sm:px-6 py-3 font-medium text-sm sm:text-base transition-all rounded-t-md ${
                mode === 'sales'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="hidden sm:inline">セールスレター</span>
              <span className="sm:hidden">セールス</span>
            </button>
            <button
              onClick={() => setMode('event')}
              className={`flex-1 px-3 sm:px-6 py-3 font-medium text-sm sm:text-base transition-all rounded-t-md ${
                mode === 'event'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="hidden sm:inline">イベント招待</span>
              <span className="sm:hidden">イベント</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
