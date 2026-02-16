'use client';

import { useState, useEffect } from 'react';
import { Document, Paragraph, Packer, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { updateStatus } from '@/lib/supabaseHistoryUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { ProFeatureModal } from './ProFeatureModal';
import { SourcesDisplay } from './SourcesDisplay';
import { SuccessGuide } from './SuccessGuide';
import type { LetterStatus } from '@/types/letter';
import type { InformationSource } from '@/types/analysis';
import type { Citation } from '@/types/generate-v2';
import type { LetterMode } from '@/types/letter';
import { normalizeLetterText } from '@/lib/textNormalize';
import { devLog } from '@/lib/logger';

// LocalStorageキー
const EDIT_USAGE_KEY = 'guest_edit_usage';
const EDIT_LIMIT = 3; // 未ログインユーザーの制限回数
const FREE_REWRITE_LIMIT = 3; // Freeユーザーのリライト制限回数

interface PreviewAreaProps {
  content: string;
  onContentChange: (content: string) => void;
  isGenerating: boolean;
  isAnalyzing?: boolean;
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
  sources?: InformationSource[];
  citations?: Citation[];
  hasUrl?: boolean;
  selfCheck?: string[];
  letterMode?: LetterMode;
  onSampleFill?: () => void;
  isDemoMode?: boolean;
  onExitDemo?: () => void;
}

function GenerationProgress({ isAnalyzing, isGenerating }: { isAnalyzing: boolean; isGenerating: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isAnalyzing && !isGenerating) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isAnalyzing, isGenerating]);

  const steps = [
    { label: '企業サイトを分析中...', active: isAnalyzing },
    { label: 'レターを生成中...', active: !isAnalyzing && isGenerating && elapsed < 20 },
    { label: '品質チェック中...', active: !isAnalyzing && isGenerating && elapsed >= 20 },
  ];

  const currentStepIndex = steps.findIndex(s => s.active);
  const estimatedTotal = isAnalyzing ? 20 : 30;
  const progressPercent = Math.min((elapsed / estimatedTotal) * 100, 95);

  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center w-full max-w-sm px-4">
        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = step.active;
            return (
              <div key={i} className={`flex items-center gap-3 ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-600' : 'text-slate-300'}`}>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-200 border-t-amber-700"></div>
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                  )}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
          <div
            className="bg-amber-600 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Elapsed time */}
        <p className="text-xs text-slate-400">
          経過: {elapsed}秒 / 目安: 約{estimatedTotal}秒
        </p>
      </div>
    </div>
  );
}

export function PreviewArea({
  content,
  onContentChange,
  isGenerating,
  isAnalyzing = false,
  currentLetterId,
  currentStatus,
  onStatusChange,
  variations,
  activeVariation,
  onVariationSelect,
  emailData,
  onEmailChange,
  onSave,
  sources,
  citations,
  hasUrl = false,
  selfCheck,
  letterMode,
  onSampleFill,
  isDemoMode = false,
  onExitDemo,
}: PreviewAreaProps) {
  const { user } = useAuth();
  const { isPro, isPremium, isFree } = useUserPlan();
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [letterStatus, setLetterStatus] = useState<LetterStatus>(currentStatus || 'generated');

  // Modals
  const [showLimitModal, setShowLimitModal] = useState(false); // Guest limit
  const [showProModal, setShowProModal] = useState(false); // Pro feature modal
  const [proFeatureName, setProFeatureName] = useState('');

  const [guestEditUsage, setGuestEditUsage] = useState(0);
  const [rewriteCount, setRewriteCount] = useState(0); // FREE user rewrite count for *current generation*
  const [showMoreEdits, setShowMoreEdits] = useState(false);

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
      devLog.error('Status update error:', error);
      showNotification('ステータスの更新に失敗しました', 'error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizeLetterText(content));
      showNotification('クリップボードにコピーしました！', 'success');
    } catch (error) {
      devLog.error('コピーエラー:', error);
      showNotification('コピーに失敗しました。', 'error');
    }
  };

  const handleExportWord = async () => {
    // Check Pro plan
    if (user && !isPro && !isPremium) {
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
      const paragraphs = normalizeLetterText(content).split('\n').map(
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
      devLog.error('Word出力エラー:', error);
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
      devLog.log('[DEBUG] 編集リクエスト:', {
        editType,
        isAuthenticated: !!user,
        guestEditUsage,
      });

      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, editType }),
      });

      devLog.log('[DEBUG] 編集レスポンス:', {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json();
        devLog.error('[ERROR] 編集エラーレスポンス:', errorData);

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
    } catch (error: unknown) {
      devLog.error('[ERROR] 編集エラー:', error);
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
      devLog.error('品質改善エラー:', error);
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
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 -mx-6 -mt-6 px-4 py-2 md:px-6 md:py-4 mb-6 rounded-t-lg">
        <div className="flex flex-col gap-2 md:gap-4">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-800 text-white hover:bg-amber-900 rounded-md transition-colors font-semibold shadow-sm"
                  aria-label="Word形式でダウンロード"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Word出力
                  {!isPro && !isPremium && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">Pro</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Stats & Status Row */}
          {content && (
            <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 text-xs md:text-sm border-t border-gray-100 pt-1.5 md:pt-0 md:border-0">
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
                    className="pl-2 pr-8 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium cursor-pointer hover:border-slate-300 transition-colors"
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
            <div className="flex md:hidden gap-2 pt-1.5 border-t border-gray-100">
              {onSave && (
                <button
                  onClick={onSave}
                  className="flex justify-center items-center gap-1 px-2.5 py-1.5 text-xs bg-teal-600 text-white hover:bg-teal-700 rounded-md transition-colors font-semibold"
                  aria-label="保存"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  保存
                </button>
              )}
              <button
                onClick={handleCopy}
                className="flex-1 flex justify-center items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium text-gray-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                コピー
              </button>
              <button
                onClick={handleExportWord}
                className="flex-1 flex justify-center items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-800 text-white hover:bg-amber-900 rounded-md transition-colors font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Word
                {!isPro && !isPremium && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">Pro</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 自動編集ボタン */}
      {content && (() => {
        const guestRemaining = EDIT_LIMIT - guestEditUsage;
        const freeRemaining = FREE_REWRITE_LIMIT - rewriteCount;
        const isGuestLimitReached = !user && guestRemaining <= 0;
        const isFreeLimitReached = !!(user && isFree && freeRemaining <= 0);
        const isEditDisabled = isEditing || isGuestLimitReached || isFreeLimitReached;

        return (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">自動編集</p>
            {!user && (
              <p className={`text-xs px-2 py-1 rounded border ${
                guestRemaining <= 0
                  ? 'text-red-600 bg-red-50 border-red-200'
                  : 'text-slate-500 bg-amber-50 border-amber-200'
              }`}>
                お試し: あと{Math.max(0, guestRemaining)}回
              </p>
            )}
            {user && isFree && (
              <p className={`text-xs px-2 py-1 rounded border ${
                freeRemaining <= 0
                  ? 'text-red-600 bg-red-50 border-red-200'
                  : 'text-slate-500 bg-blue-50 border-blue-200'
              }`}>
                あと{Math.max(0, freeRemaining)}回 / 生成
              </p>
            )}
          </div>

          {/* 制限到達時のアップグレード案内 */}
          {isGuestLimitReached && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              お試し利用回数を使い切りました。
              <Link href="/login" className="ml-1 font-bold text-amber-900 underline hover:text-amber-700">
                無料登録で回数を増やす
              </Link>
            </div>
          )}
          {isFreeLimitReached && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              この手紙の編集回数上限に達しました。新しい手紙を生成するとリセットされます。
            </div>
          )}

          {/* おすすめ3つ */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAutoEdit('shorten')}
              disabled={isEditDisabled}
              className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="文章を短縮"
            >
              もっと短く
              <span className="text-[10px] text-amber-600 font-medium bg-amber-100 px-1 rounded">おすすめ</span>
            </button>
            <button
              onClick={() => handleAutoEdit('proofread')}
              disabled={isEditDisabled}
              className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="誤字脱字・表現チェック"
            >
              誤字脱字チェック
              <span className="text-[10px] text-amber-600 font-medium bg-amber-100 px-1 rounded">おすすめ</span>
            </button>
            <button
              onClick={() => handleAutoEdit('emphasize')}
              disabled={isEditDisabled}
              className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              aria-label="事例を強調"
            >
              事例を強調
              <span className="text-[10px] text-amber-600 font-medium bg-amber-100 px-1 rounded">おすすめ</span>
            </button>
          </div>

          {/* その他の編集（折りたたみ） */}
          <div>
            <button
              type="button"
              onClick={() => setShowMoreEdits(!showMoreEdits)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${showMoreEdits ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              その他の編集
            </button>
            {showMoreEdits && (
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => handleAutoEdit('casual')}
                  disabled={isEditDisabled}
                  className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="カジュアルな表現に変更"
                  title="堅い表現をやわらかくします"
                >
                  カジュアルに
                </button>
                <button
                  onClick={() => handleAutoEdit('passionate')}
                  disabled={isEditDisabled}
                  className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="もっと情熱的に"
                  title="熱意を感じる表現に書き換えます"
                >
                  もっと情熱的に
                </button>
                <button
                  onClick={() => handleAutoEdit('concise')}
                  disabled={isEditDisabled}
                  className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="もっと簡潔に（8割の長さに）"
                  title="全体を8割程度の長さに圧縮します"
                >
                  もっと簡潔に（8割）
                </button>
                <button
                  onClick={() => handleAutoEdit('businesslike')}
                  disabled={isEditDisabled}
                  className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="ビジネスライクに修正"
                  title="フォーマルなビジネス文体に整えます"
                >
                  ビジネスライクに
                </button>
                <button
                  onClick={handleQualityImprove}
                  disabled={isEditDisabled}
                  className="px-3 py-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                  aria-label="Gemini Proで品質改善"
                  title="AIが全体の品質を総合的に改善します"
                >
                  品質改善
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">Pro</span>
                </button>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* プレビューエリア */}
      <div className="relative border border-gray-300 rounded-md min-h-[600px] bg-white">
        {/* 編集可能ヒント */}



        {/* タブUI（バリエーション選択） - 生成されている場合のみ表示 */}
        {variations && (
          <div className="flex border-b border-gray-200 mb-0">
            <button
              onClick={() => onVariationSelect && onVariationSelect('standard')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'standard'
                ? 'border-amber-700 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              王道 (Standard)
            </button>
            <button
              onClick={() => onVariationSelect && onVariationSelect('emotional')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'emotional'
                ? 'border-amber-700 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              熱意 (Emotional)
            </button>
            <button
              onClick={() => onVariationSelect && onVariationSelect('consultative')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeVariation === 'consultative'
                ? 'border-amber-700 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              課題解決 (Consultative)
            </button>
          </div>
        )}

        {isGenerating || isEditing ? (
          isEditing ? (
            <div className="flex items-center justify-center min-h-[600px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
                <p className="text-gray-600">編集中...</p>
              </div>
            </div>
          ) : (
            <GenerationProgress isAnalyzing={isAnalyzing} isGenerating={isGenerating} />
          )

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
                  const fullText = `件名: ${emailData.subject}\n\n${normalizeLetterText(emailData.body)}`;
                  navigator.clipboard.writeText(fullText);
                  showNotification('件名と本文をコピーしました', 'success');
                }}
                className="px-4 py-2 bg-amber-800 text-white rounded shadow hover:bg-amber-900 transition flex items-center gap-2"
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
              className="w-full min-h-[600px] p-8 pt-12 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-b-md resize-y font-serif text-gray-800 leading-relaxed bg-white text-[15px]"
              style={{
                lineHeight: '1.8',
              }}
              placeholder="生成された手紙がここに表示されます"
              aria-label="生成された手紙の編集エリア"
            />

          </>
        ) : (
          <div className="relative min-h-[600px]">
            {/* サンプルレター（グレーアウト） */}
            <div className="p-8 font-serif text-gray-800 leading-relaxed text-[15px] opacity-[0.12] select-none pointer-events-none" style={{ lineHeight: '1.8' }}>
              <p>株式会社サンプル商事</p>
              <p>代表取締役社長 山田太郎 様</p>
              <p className="mt-4">突然のご連絡失礼いたします。</p>
              <p>株式会社テクノロジーズの田中と申します。</p>
              <p className="mt-3">貴社が先日発表された中期経営計画における「デジタル基盤の刷新」に関する取り組みを拝見し、ご連絡差し上げました。</p>
              <p className="mt-3">弊社は、大手企業様を中心に500社以上のDX推進を支援してまいりました。直近では、同業界のA社様において、基幹システムの刷新により業務処理時間を40%削減した実績がございます。</p>
              <p className="mt-3">貴社の掲げる「2026年度までの全社デジタル化」の実現に向け、弊社の知見がお役に立てるのではないかと考えております。</p>
              <p className="mt-3">まずは15分ほどのお時間をいただき、情報交換の機会を頂戴できませんでしょうか。</p>
            </div>
            {/* オーバーレイ */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
              <div className="text-center px-8 max-w-sm">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-stone-800 mb-2">こんなレターが30秒で完成</p>
                <p className="text-sm text-stone-500 mb-6">
                  左のフォームに企業URLを入力するか、まずはサンプルで体験してみてください。
                </p>
                {onSampleFill && (
                  <button
                    onClick={onSampleFill}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-800 text-white rounded-lg font-bold text-base hover:bg-amber-900 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    サンプルで試してみる
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 情報ソース表示（生成後のみ） */}
      {content && (
        <div className="mt-6">
          <SourcesDisplay
            sources={sources}
            citations={citations}
            hasUrl={hasUrl}
            defaultExpanded={false}
            bodyText={content}
          />
        </div>
      )}

      {/* 成功への3ステップガイド（生成後のみ） */}
      {content && !isGenerating && !isEditing && (
        <SuccessGuide isFirstGeneration={!currentLetterId} />
      )}

      {/* デモモード完了CTA */}
      {isDemoMode && content && !isGenerating && !isEditing && onExitDemo && (
        <div className="mt-6 p-5 bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 rounded-lg text-center">
          <p className="text-sm text-stone-700 mb-3">
            これはサンプルデータで生成したデモです。実際のターゲット企業で試してみましょう。
          </p>
          <button
            onClick={onExitDemo}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-800 text-white rounded-lg font-bold text-sm hover:bg-amber-900 transition-all shadow-md"
          >
            自分の案件で作成する
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      )}

      {/* Pro Feature Modal */}
      <ProFeatureModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        featureName={proFeatureName}
      />

      {/* 編集機能制限到達モーダル（損失回避フレーミング） */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700"></div>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">もう少しで理想の文面に！</h3>
            <p className="text-stone-600 mb-6 leading-relaxed text-center">
              無料登録すると、AI編集を無制限で利用できます。<br />
              <span className="text-xs text-stone-400">30秒で完了・クレジットカード不要</span>
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>AI編集が無制限</strong>に利用可能</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>作成したレターの<strong>履歴を保存</strong></span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>生成回数も<strong>1日10回</strong>に拡大</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full py-3 px-4 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 text-center"
              >
                無料で登録して続ける
              </Link>
              <button
                onClick={() => setShowLimitModal(false)}
                className="block w-full py-3 px-4 text-stone-400 hover:text-stone-600 text-sm font-medium transition-colors"
              >
                登録不要で明日また使う
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
