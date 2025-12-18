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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showNotification('クリップボードにコピーしました！', 'success');
    } catch (error) {
      console.error('コピーエラー:', error);
      showNotification('コピーに失敗しました。', 'error');
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
      showNotification('Wordファイルをダウンロードしました！', 'success');
    } catch (error) {
      console.error('Word出力エラー:', error);
      showNotification('Word出力に失敗しました。', 'error');
    }
  };

  const handleAutoEdit = async (editType: string) => {
    if (!content) {
      showNotification('まず手紙を生成してください。', 'error');
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
        showNotification('編集が完了しました！', 'success');
      }
    } catch (error) {
      console.error('編集エラー:', error);
      showNotification('編集に失敗しました。', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const handleQualityImprove = async () => {
    if (!content) {
      showNotification('まず手紙を生成してください。', 'error');
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
        showNotification('品質改善が完了しました！', 'success');
      }
    } catch (error) {
      console.error('品質改善エラー:', error);
      showNotification('品質改善に失敗しました。', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 lg:sticky lg:top-8 h-fit">
      {/* 通知 */}
      {notification && (
        <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
          notification.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

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
      <div className="relative border border-gray-300 rounded-md min-h-[500px] bg-white">
        {/* 編集可能ヒント */}
        {content && !isGenerating && !isEditing && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200 z-10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>直接編集できます</span>
          </div>
        )}

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
            className="w-full h-[500px] p-8 pt-12 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-md resize-none font-serif text-gray-800 leading-relaxed bg-white"
            style={{
              lineHeight: '1.8',
              fontSize: '15px',
              fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', serif",
            }}
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
