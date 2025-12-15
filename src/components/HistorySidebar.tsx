'use client';

import { useEffect, useState } from 'react';

interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
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
}

export function HistorySidebar({ onRestore }: HistorySidebarProps) {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full overflow-hidden flex flex-col">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">
        履歴（最新10件）
      </h2>

      <div className="overflow-y-auto flex-1">
        {histories.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            履歴がありません
          </p>
        ) : (
          <div className="space-y-2">
            {histories.map((history) => (
              <div
                key={history.id}
                className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onRestore(history)}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-medium text-sm text-gray-800 line-clamp-1">
                    {history.targetCompany}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(history.id, e)}
                    className="text-xs text-red-600 hover:text-red-700 ml-2"
                    aria-label="削除"
                  >
                    ✕
                  </button>
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
