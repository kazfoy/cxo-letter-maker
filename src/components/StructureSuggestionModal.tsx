'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Approach {
  type: string;
  title: string;
  description: string;
  draftText: string;
}

interface StructureSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectApproach: (draftText: string) => void;
  companyName: string;
  myServiceDescription: string;
  background?: string;
}

export function StructureSuggestionModal({
  isOpen,
  onClose,
  onSelectApproach,
  companyName,
  myServiceDescription,
  background,
}: StructureSuggestionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/suggest-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          myServiceDescription,
          background,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || '構成案の取得に失敗しました');
      }

      setApproaches(data.approaches);
    } catch (err) {
      console.error('構成案取得エラー:', err);
      setError(err instanceof Error ? err.message : '構成案の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [companyName, myServiceDescription, background]);

  useEffect(() => {
    if (isOpen && approaches.length === 0) {
      fetchSuggestions();
    }
  }, [isOpen, approaches.length, fetchSuggestions]);

  const handleSelectApproach = (draftText: string) => {
    onSelectApproach(draftText);
    onClose();
  };

  const handleClose = () => {
    setApproaches([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">💡 構成案を相談</h3>
            <p className="text-sm text-gray-600 mt-1">
              AIが3つのアプローチ案を提案します。お好みの案を選択してください。
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">AIが構成案を考えています...</p>
                <p className="text-sm text-gray-500 mt-2">少々お待ちください</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-800 font-medium mb-2">エラーが発生しました</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                onClick={fetchSuggestions}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                再試行
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {approaches.map((approach, index) => (
                <div
                  key={index}
                  className="border-2 border-gray-200 rounded-lg p-5 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => handleSelectApproach(approach.draftText)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                      {approach.title}
                    </h4>
                    <button
                      className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-md hover:bg-blue-200 transition-colors text-sm font-medium group-hover:bg-blue-600 group-hover:text-white"
                      aria-label="この案を選択"
                    >
                      選択
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{approach.description}</p>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-xs text-gray-500 mb-2 font-medium">骨子（プレビュー）</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {approach.draftText.length > 300
                        ? `${approach.draftText.substring(0, 300)}...`
                        : approach.draftText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            選択した構成案が「まとめて入力」欄に挿入されます。その後、自由に編集できます。
          </p>
        </div>
      </div>
    </div>
  );
}
