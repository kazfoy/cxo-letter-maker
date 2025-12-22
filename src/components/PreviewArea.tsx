'use client';

import { useState, useEffect } from 'react';
import { Document, Paragraph, Packer, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { updateStatus } from '@/lib/supabaseHistoryUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { ProFeatureModal } from './ProFeatureModal';
import type { LetterStatus } from '@/types/letter';

// LocalStorageキー
const EDIT_USAGE_KEY = 'guest_edit_usage';
const EDIT_LIMIT = 3; // 未ログインユーザーの制限回数
const FREE_REWRITE_LIMIT = 3; // Freeユーザーのリライト制限回数

interface PreviewAreaProps {
  content: string;
  onContentChange: (content: string) => void;
  isGenerating: boolean;
  currentLetterId?: string;
  currentStatus?: LetterStatus;

  onStatusChange?: () => void;
  variations?: {
    standard: string;
    emotional: string;
    consultative: string;
  };
  activeVariation?: 'standard' | 'emotional' | 'consultative';
  onVariationSelect?: (variation: 'standard' | 'emotional' | 'consultative') => void;
  emailData?: {
    subject: string;
    body: string;
  };
  onEmailChange?: (email: { subject: string; body: string }) => void;
  onSave?: () => void;
}

export function PreviewArea({
  content,
  onContentChange,
  isGenerating,
  currentLetterId,
  currentStatus,
  onStatusChange,
  variations,
  activeVariation,
  onVariationSelect,
  emailData,
  onEmailChange,
  onSave,
}: PreviewAreaProps) {
  const { user } = useAuth();
  const { isPro, isFree } = useUserPlan();
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [letterStatus, setLetterStatus] = useState<LetterStatus>(currentStatus || 'generated');

  // Modals
  const [showLimitModal, setShowLimitModal] = useState(false); // Guest limit
  const [showProModal, setShowProModal] = useState(false); // Pro feature modal
  const [proFeatureName, setProFeatureName] = useState('');

  const [guestEditUsage, setGuestEditUsage] = useState(0);
  const [rewriteCount, setRewriteCount] = useState(0); // FREE user rewrite count for *current generation*

  // Sync letterStatus when currentStatus changes
  useEffect(() => {
    if (currentStatus) {
      setLetterStatus(currentStatus);
    }
  }, [currentStatus]);

  // Reset rewrite count when content changes significantly (or ideally when new generation happens)
  // For now, let's keep it simple: reset when letterId changes
  useEffect(() => {
    setRewriteCount(0);
  }, [currentLetterId]);

  // 未ログインユーザーの編集利用回数を確認
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const usage = parseInt(localStorage.getItem(EDIT_USAGE_KEY) || '0', 10);
      setGuestEditUsage(usage);
    }
  }, [user]);

  // 未ログインユーザーの編集利用回数を記録
  const incrementGuestEditUsage = () => {
    if (!user && typeof window !== 'undefined') {
      const newUsage = guestEditUsage + 1;
      localStorage.setItem(EDIT_USAGE_KEY, newUsage.toString());
      setGuestEditUsage(newUsage);
    }
  };

  // 未ログインユーザーの編集制限チェック
  const canUseEdit = () => {
    if (user) return true; // ログインユーザーは無制限
    return guestEditUsage < EDIT_LIMIT; // 未ログインは制限あり
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusChange = async (newStatus: LetterStatus) => {
    if (!currentLetterId) {
      showNotification('履歴に保存されている手紙のみステータスを変更できます', 'error');
      return;
    }

    try {
      const updated = await updateStatus(currentLetterId, newStatus);
      if (updated) {
        setLetterStatus(newStatus);
        showNotification('ステータスを更新しました', 'success');
        if (onStatusChange) {
          onStatusChange();
        }
      }
    } catch (error) {
      console.error('Status update error:', error);
      showNotification('ステータスの更新に失敗しました', 'error');
    }
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
    // Check Pro plan
    if (user && !isPro) {
      setProFeatureName('Wordダウンロード');
      setShowProModal(true);
      return;
    }
    // Guest usage? Prompt login?
    // Requirement says: "Freeプラン: ... Proプラン限定機能です... Proプラン: 通常通り"
    // Guest handling not specified, but usually guest is treated as Free or stricter.
    // If guest, maybe show same modal or user prompt?
    // Let's treat guest same as Free for feature restriction (block it).
    if (!user) {
      setProFeatureName('Wordダウンロード');
      setShowProModal(true);
      return;
    }

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

    // 未ログインユーザーの制限チェック
    if (!canUseEdit()) {
      setShowLimitModal(true);
      return;
    }

    // Freeプランのリライト制限チェック (Logged in user)
    if (user && isFree && rewriteCount >= FREE_REWRITE_LIMIT) {
      setProFeatureName('無制限のAI編集');
      setShowProModal(true);
      return;
    }

    setIsEditing(true);

    try {
      console.log('[DEBUG] 編集リクエスト:', {
        editType,
        isAuthenticated: !!user,
        guestEditUsage,
      });

      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, editType }),
      });

      console.log('[DEBUG] 編集レスポンス:', {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ERROR] 編集エラーレスポンス:', errorData);

        if (response.status === 429) {
          showNotification('利用制限に達しました。しばらく待ってから再試行してください。', 'error');
        } else {
          showNotification(errorData.error || '編集に失敗しました。', 'error');
        }
        return;
      }

      const data = await response.json();
      if (data.editedLetter) {
        onContentChange(data.editedLetter);
        showNotification('編集が完了しました！', 'success');

        // Free user rewrite count check
        if (user && isFree) {
          setRewriteCount(prev => prev + 1);
        }

        // 未ログインユーザーの場合、利用回数をカウント
        if (!user) {
          incrementGuestEditUsage();
          // ... (rest of simple guest usage logic)

          // 残り回数を通知
          const remaining = EDIT_LIMIT - guestEditUsage - 1;
          if (remaining > 0) {
            setTimeout(() => {
              showNotification(`お試しあと${remaining}回利用できます`, 'success');
            }, 3500);
          } else {
            setTimeout(() => {
              showNotification('お試し利用回数を使い切りました。ログインすると無制限で利用できます。', 'error');
            }, 3500);
          }
        }
      }
    } catch (error: any) {
      console.error('[ERROR] 編集エラー:', error);
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

  // Character count and reading time calculation
  const charCount = content.replace(/\s/g, '').length; // Exclude whitespace
  const readingTimeMinutes = charCount > 0 ? Math.ceil(charCount / 500) : 0; // Japanese reading speed ~500 chars/min

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
      {/* 通知 */}
      {notification && (
        <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${notification.type === 'success'
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

      {/* Fixed Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 -mx-6 -mt-6 px-6 py-4 mb-6 rounded-t-lg">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start md:items-center">
            {/* Left side: Title */}
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">プレビュー</h2>

            {/* Right side: Action buttons (Desktop) */}
            {content && (
              <div className="hidden md:flex gap-2">
                {onSave && (
                  <button
                    onClick={onSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white hover:bg-teal-700 rounded-md transition-colors font-semibold shadow-sm"
                    aria-label="履歴に保存"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    履歴に保存
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium text-gray-700"
                  aria-label="クリップボードにコピー"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  コピー
                </button>
                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-md transition-colors font-semibold shadow-sm"
                  aria-label="Word形式でダウンロード"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Word出力
                </button>
              </div>
            )}
          </div>

          {/* Stats & Status Row */}
          {content && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm border-t border-gray-100 pt-3 md:border-0 md:pt-0">
              <div className="flex items-center gap-4 text-gray-600">
                <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {charCount}文字
                </span>
                <span className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  約{readingTimeMinutes}分
                </span>
              </div>

              {currentLetterId && (
                <div className="flex items-center gap-2 ml-auto md:ml-0">
                  <select
                    id="letter-status"
                    value={letterStatus}
                    onChange={(e) => handleStatusChange(e.target.value as LetterStatus)}
                    className="pl-2 pr-8 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium cursor-pointer hover:border-slate-300 transition-colors"
                  >
                    <option value="draft">下書き</option>
                    <option value="generated">作成済</option>
                    <option value="sent">送付済</option>
                    <option value="replied">返信あり</option>
                    <option value="meeting_set">アポ獲得</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Mobile Actions (Bottom Row) */}
          {content && (
            <div className="flex md:hidden gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleCopy}
                className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                コピー
              </button>
              <button
                onClick={handleExportWord}
                className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-md transition-colors font-semibold shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Word
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 自動編集ボタン */}
      {content && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">自動編集</p>
            {!user && (
              <p className="text-xs text-slate-500 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                お試し: あと{EDIT_LIMIT - guestEditUsage}回
              </p>
            )}
          </div>
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
      <div className="relative border border-gray-300 rounded-md min-h-[600px] bg-white">
        {/* 編集可能ヒント */}



        {/* タブUI（バリエーション選択） - 生成されている場合のみ表示 */}
        {variations && (
          <div className="flex border-b border-gray-200 mb-0">
            <button
              onClick={() => onVariationSelect && onVariationSelect('standard')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'standard'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              王道 (Standard)
            </button>
            <button
              onClick={() => onVariationSelect && onVariationSelect('emotional')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'emotional'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              熱意 (Emotional)
            </button>
            <button
              onClick={() => onVariationSelect && onVariationSelect('consultative')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'consultative'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              課題解決 (Consultative)
            </button>
          </div>
        )}

        {isGenerating || isEditing ? (
          <div className="flex items-center justify-center min-h-[600px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isGenerating ? '手紙を生成中...' : '編集中...'}
              </p>
            </div>
          </div>

        ) : emailData ? (
          <div className="flex flex-col h-full bg-white rounded-md min-h-[600px]">
            {/* メールヘッダー（件名） */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-md">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                件名 (Subject)
              </label>
              <input
                type="text"
                value={emailData.subject}
                onChange={(e) => onEmailChange && onEmailChange({ ...emailData, subject: e.target.value })}
                className="w-full bg-transparent border-none text-lg font-semibold text-gray-900 focus:ring-0 px-0 py-1"
                placeholder="件名を入力"
              />
            </div>

            {/* メール本文 */}
            <textarea
              value={emailData.body}
              onChange={(e) => onEmailChange && onEmailChange({ ...emailData, body: e.target.value })}
              className="flex-1 w-full p-8 focus:outline-none resize-none font-sans text-gray-800 leading-relaxed bg-white text-[15px] rounded-b-md"
              style={{ lineHeight: '1.6' }}
              placeholder="メール本文"
            />

            {/* メール用アクションボタン（簡易） */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  // メールコピー (件名 + 本文)
                  const fullText = `件名: ${emailData.subject}\n\n${emailData.body}`;
                  navigator.clipboard.writeText(fullText);
                  showNotification('件名と本文をコピーしました', 'success');
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                コピー
              </button>
            </div>
          </div>
        ) : content ? (
          <>
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full min-h-[600px] p-8 pt-12 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-b-md resize-y font-serif text-gray-800 leading-relaxed bg-white text-[15px]"
              style={{
                lineHeight: '1.8',
              }}
              placeholder="生成された手紙がここに表示されます"
              aria-label="生成された手紙の編集エリア"
            />

          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[600px] text-gray-400 px-8">
            <div className="text-6xl mb-4">✉️</div>
            <p className="text-lg font-medium text-gray-600 mb-2">ここに手紙が表示されます</p>
            <p className="text-sm text-gray-500 text-center max-w-md">
              AIがプロ品質の手紙を書きます。左側のフォームに情報を入力して「手紙を作成する」をクリックしてください。
            </p>
          </div>
        )}
      </div>

      {/* Pro Feature Modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        featureName={proFeatureName}
      />

      {/* 編集機能制限到達モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-purple-500"></div>
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">お試し利用回数を使い切りました</h3>
            <p className="text-slate-600 mb-8 leading-relaxed">
              自動編集機能は1時間に3回までお試しいただけます。<br />
              無料会員登録すると、無制限で利用可能です。
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105"
              >
                無料で会員登録・ログイン
              </Link>
              <button
                onClick={() => setShowLimitModal(false)}
                className="block w-full py-3 px-4 text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
