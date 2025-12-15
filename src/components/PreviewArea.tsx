'use client';

import { useState } from 'react';
import { Document, Paragraph, Packer, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface PreviewAreaProps {
  content: string;
  onContentChange: (content: string) => void;
  isGenerating: boolean;
}

export function PreviewArea({
  content,
  onContentChange,
  isGenerating,
}: PreviewAreaProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('クリップボードにコピーしました！');
    } catch (error) {
      console.error('コピーエラー:', error);
      alert('コピーに失敗しました。');
    }
  };

  const handleExportWord = async () => {
    try {
      const paragraphs = content.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 200 },
          })
      );

      const doc = new Document({
        sections: [{ children: paragraphs }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'cxo_letter.docx');
    } catch (error) {
      console.error('Word出力エラー:', error);
      alert('Word出力に失敗しました。');
    }
  };

  const handleAutoEdit = async (editType: string) => {
    if (!content) {
      alert('まず手紙を生成してください。');
      return;
    }

    setIsEditing(true);

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, editType }),
      });

      const data = await response.json();
      if (data.editedLetter) {
        onContentChange(data.editedLetter);
      }
    } catch (error) {
      console.error('編集エラー:', error);
      alert('編集に失敗しました。');
    } finally {
      setIsEditing(false);
    }
  };

  const handleQualityImprove = async () => {
    if (!content) {
      alert('まず手紙を生成してください。');
      return;
    }

    setIsEditing(true);

    try {
      const response = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.improvedLetter) {
        onContentChange(data.improvedLetter);
      }
    } catch (error) {
      console.error('品質改善エラー:', error);
      alert('品質改善に失敗しました。');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 lg:sticky lg:top-8 h-fit">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">プレビュー</h2>
        {content && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              aria-label="クリップボードにコピー"
            >
              コピー
            </button>
            <button
              onClick={handleExportWord}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              aria-label="Word形式でダウンロード"
            >
              Word出力
            </button>
          </div>
        )}
      </div>

      {/* 自動編集ボタン */}
      {content && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">自動編集</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAutoEdit('casual')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="カジュアルな表現に変更"
            >
              カジュアルに
            </button>
            <button
              onClick={() => handleAutoEdit('emphasize')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="事例を強調"
            >
              事例を強調
            </button>
            <button
              onClick={() => handleAutoEdit('shorten')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="文章を短縮"
            >
              もっと短く
            </button>
            <button
              onClick={() => handleAutoEdit('passionate')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="もっと情熱的に"
            >
              もっと情熱的に
            </button>
            <button
              onClick={() => handleAutoEdit('concise')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="もっと簡潔に（8割の長さに）"
            >
              もっと簡潔に（8割）
            </button>
            <button
              onClick={() => handleAutoEdit('businesslike')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="ビジネスライクに修正"
            >
              ビジネスライクに
            </button>
            <button
              onClick={() => handleAutoEdit('proofread')}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="誤字脱字・表現チェック"
            >
              誤字脱字チェック
            </button>
            <button
              onClick={handleQualityImprove}
              disabled={isEditing}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              aria-label="Gemini Proで品質改善"
            >
              品質改善 (Pro)
            </button>
          </div>
        </div>
      )}

      {/* プレビューエリア */}
      <div className="border border-gray-300 rounded-md min-h-[500px]">
        {isGenerating || isEditing ? (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isGenerating ? '手紙を生成中...' : '編集中...'}
              </p>
            </div>
          </div>
        ) : content ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full h-[500px] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md resize-none"
            placeholder="生成された手紙がここに表示されます"
            aria-label="生成された手紙の編集エリア"
          />
        ) : (
          <div className="flex items-center justify-center h-[500px] text-gray-400">
            左側のフォームに情報を入力して「手紙を生成」をクリックしてください
          </div>
        )}
      </div>
    </div>
  );
}
