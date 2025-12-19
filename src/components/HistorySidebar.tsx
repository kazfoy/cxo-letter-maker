'use client';

import { useEffect, useState } from 'react';
import { togglePin } from '@/lib/historyUtils';

interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
  isPinned?: boolean;
  mode?: 'sales' | 'event'; // セールスレターまたはイベント招待
  inputs: {
    myCompanyName: string;
    myName: string;
    myServiceDescription: string;
    companyName: string;
    position: string;
    name: string;
    background: string;
    problem: string;
    solution: string;
    caseStudy: string;
    offer: string;
  };
}

interface HistorySidebarProps {
  onRestore: (history: LetterHistory) => void;
  onSampleExperience?: () => void;
}

export function HistorySidebar({ onRestore, onSampleExperience }: HistorySidebarProps) {
  const [histories, setHistories] = useState<LetterHistory[]>([]);

  useEffect(() => {
    loadHistories();
    // ストレージの変更を監視
    window.addEventListener('storage', loadHistories);
    return () => window.removeEventListener('storage', loadHistories);
  }, []);

  const loadHistories = () => {
    try {
      const stored = localStorage.getItem('letterHistories');
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistories(parsed);
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を止める
    try {
      const updated = histories.filter((h) => h.id !== id);
      localStorage.setItem('letterHistories', JSON.stringify(updated));
      setHistories(updated);
    } catch (error) {
      console.error('履歴削除エラー:', error);
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を止める
    try {
      const updated = togglePin(id);
      setHistories(updated);
    } catch (error) {
      console.error('ピン留め切り替えエラー:', error);
    }
  };

  // ピン留めされたアイテムを上部に表示
  const sortedHistories = [...histories].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0; // 同じピン状態内では元の順序を保持
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">
        履歴（最新10件）
      </h2>

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
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-md hover:from-blue-600 hover:to-purple-600 transition-all font-medium shadow-md hover:shadow-lg"
              >
                ✨ サンプルで体験する
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
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
