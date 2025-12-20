'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getHistories, togglePin, deleteHistory, type LetterHistory, type LetterStatus } from '@/lib/supabaseHistoryUtils';

interface HistorySidebarProps {
  onRestore: (history: LetterHistory) => void;
  onSampleExperience?: () => void;
  isOpen: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
}

// Helper function to get status badge styling
const getStatusBadge = (status?: LetterStatus) => {
  const s = status || 'generated';
  const badges = {
    draft: { label: '下書き', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    generated: { label: '作成済', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    sent: { label: '送付済', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    replied: { label: '返信あり', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    meeting_set: { label: 'アポ獲得', color: 'bg-green-100 text-green-700 border-green-300' },
  };
  return badges[s];
};

export function HistorySidebar({ onRestore, onSampleExperience, isOpen, onToggle, refreshTrigger }: HistorySidebarProps) {
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>('all');
  const { user } = useAuth();

  useEffect(() => {
    loadHistories();
  }, [user]);

  // Reload when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadHistories();
    }
  }, [refreshTrigger]);

  // Poll for updates every 10 seconds to catch new letters
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadHistories();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const loadHistories = async () => {
    try {
      const histories = await getHistories();
      setHistories(histories);
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を止める
    try {
      const updated = await deleteHistory(id);
      setHistories(updated);
    } catch (error) {
      console.error('履歴削除エラー:', error);
    }
  };

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を止める
    try {
      const updated = await togglePin(id);
      setHistories(updated);
    } catch (error) {
      console.error('ピン留め切り替えエラー:', error);
    }
  };

  // Filter by status
  // Note: Sorting is already done at database level (pinned first, then by created_at)
  const filteredHistories = statusFilter === 'all'
    ? histories
    : histories.filter(h => (h.status || 'generated') === statusFilter);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full md:h-auto overflow-y-auto md:overflow-visible">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 leading-relaxed">
          履歴（最新10件）
        </h2>
        {isOpen && (
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors md:hidden"
            aria-label="履歴を閉じる"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {isOpen && (
          <button
            onClick={onToggle}
            className="hidden md:block p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="履歴を閉じる"
            title="履歴を閉じる"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <label htmlFor="status-filter" className="block text-xs font-medium text-slate-700 mb-1.5">
          ステータスで絞り込み
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LetterStatus | 'all')}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">すべて表示</option>
          <option value="draft">下書き</option>
          <option value="generated">作成済</option>
          <option value="sent">送付済</option>
          <option value="replied">返信あり</option>
          <option value="meeting_set">アポ獲得</option>
        </select>
      </div>

      <div>
        {filteredHistories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="text-6xl mb-4">📂</div>
            <p className="text-lg font-medium text-gray-600 mb-3">まだ履歴はありません</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 w-full">
              <p className="text-sm font-medium text-blue-900 mb-2">使い方（3ステップ）</p>
              <ol className="text-xs text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="font-bold flex-shrink-0">1.</span>
                  <span>基本情報（会社名、名前など）を入力</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold flex-shrink-0">2.</span>
                  <span>手紙の内容を入力（またはAIアシスト）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold flex-shrink-0">3.</span>
                  <span>「手紙を作成する」をクリック</span>
                </li>
              </ol>
            </div>

          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistories.map((history) => (
              <div
                key={history.id}
                className={`group relative border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-all ${history.isPinned
                  ? 'bg-amber-50 border-amber-200 shadow-sm'
                  : 'border-slate-100 hover:border-slate-300'
                  }`}
                onClick={() => onRestore(history)}
              >
                {/* Header: Company Name & Date */}
                <div className="flex justify-between items-start mb-2 pr-6">
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1 leading-tight">
                    {history.targetCompany || '未設定の企業'}
                  </h3>
                </div>

                {/* Target Person */}
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {history.targetName ? `${history.targetName} 様` : '担当者未設定'}
                </p>

                {/* Badges Row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {/* Mode Badge */}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${(history.mode || 'sales') === 'event'
                    ? 'bg-orange-50 text-orange-700 border-orange-100'
                    : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                    {(history.mode || 'sales') === 'event' ? 'Event' : 'Letter'}
                  </span>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(history.status).color
                    }`}>
                    {getStatusBadge(history.status).label}
                  </span>
                </div>

                {/* Footer: Date & Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100/50 mt-1">
                  <span className="text-[10px] text-slate-400">
                    {new Date(history.createdAt).toLocaleDateString('ja-JP', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {/* Delete Button (Icon) */}
                  <button
                    onClick={(e) => handleDelete(history.id, e)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="削除"
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Pin button - absolute positioned at top-right */}
                <button
                  onClick={(e) => handleTogglePin(history.id, e)}
                  className={`absolute top-2 right-2 p-1 rounded-full transition-all ${history.isPinned
                    ? 'text-amber-400 hover:text-amber-500'
                    : 'text-slate-300 hover:text-slate-400 opacity-0 group-hover:opacity-100'
                    }`}
                  aria-label={history.isPinned ? 'ピン留め解除' : 'ピン留め'}
                  title={history.isPinned ? 'ピン留め解除' : 'ピン留め'}
                >
                  <svg
                    className="w-4 h-4"
                    fill={history.isPinned ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
