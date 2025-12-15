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

interface HistoryPanelProps {
  onRestore: (history: LetterHistory) => void;
}

export function HistoryPanel({ onRestore }: HistoryPanelProps) {
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadHistories();
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

  const handleDelete = (id: string) => {
    try {
      const updated = histories.filter((h) => h.id !== id);
      localStorage.setItem('letterHistories', JSON.stringify(updated));
      setHistories(updated);
    } catch (error) {
      console.error('履歴削除エラー:', error);
    }
  };

  const handleClearAll = () => {
    if (confirm('すべての履歴を削除しますか？')) {
      localStorage.removeItem('letterHistories');
      setHistories([]);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        aria-label="履歴を表示"
      >
        履歴 ({histories.length})
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">作成履歴</h2>
              <div className="flex gap-2">
                {histories.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-sm text-red-600 hover:text-red-700"
                    aria-label="すべての履歴を削除"
                  >
                    すべて削除
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {histories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  履歴がありません
                </p>
              ) : (
                <div className="space-y-3">
                  {histories.map((history) => (
                    <div
                      key={history.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-800">
                            {history.targetCompany} {history.targetName}様
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(history.createdAt).toLocaleString('ja-JP')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onRestore(history);
                              setIsOpen(false);
                            }}
                            className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                            aria-label="この履歴を復元"
                          >
                            復元
                          </button>
                          <button
                            onClick={() => handleDelete(history.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                            aria-label="この履歴を削除"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {history.content.substring(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
