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
  const filteredHistories = statusFilter === 'all'
    ? histories
    : histories.filter(h => (h.status || 'generated') === statusFilter);

  // ピン留めされたアイテムを上部に表示
  const sortedHistories = [...filteredHistories].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0; // 同じピン状態内では元の順序を保持
  });

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
        {sortedHistories.length === 0 ? (
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
            {onSampleExperience && (
              <button
                onClick={onSampleExperience}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg"
              >
                ✨ サンプルで体験する
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedHistories.map((history) => (
              <div
                key={history.id}
                className={`border rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  history.isPinned
                    ? 'bg-amber-50 border-amber-300'
                    : ''
                }`}
                onClick={() => onRestore(history)}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-gray-800 line-clamp-1">
                      {history.targetCompany}
                    </h3>
                    {/* モードバッジ */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                      (history.mode || 'sales') === 'event'
                        ? 'bg-orange-100 text-orange-800 border border-orange-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {(history.mode || 'sales') === 'event' ? 'Event' : 'Letter'}
                    </span>
                    {/* ステータスバッジ */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 border ${
                      getStatusBadge(history.status).color
                    }`}>
                      {getStatusBadge(history.status).label}
                    </span>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleTogglePin(history.id, e)}
                      className={`text-sm hover:scale-110 transition-transform ${
                        history.isPinned ? 'text-amber-600' : 'text-gray-400'
                      }`}
                      aria-label={history.isPinned ? 'ピン留め解除' : 'ピン留め'}
                      title={history.isPinned ? 'ピン留め解除' : 'ピン留めすると自動削除されません'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => handleDelete(history.id, e)}
                      className="text-xs text-red-600 hover:text-red-700"
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-1">
                  {history.targetName}様
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(history.createdAt).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
