'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { AnalysisPreviewModal } from '@/components/AnalysisPreviewModal';
import { WelcomeWizard } from '@/components/WelcomeWizard';
import { saveToHistory } from '@/lib/supabaseHistoryUtils';
import { getProfile } from '@/lib/profileUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestLimit } from '@/hooks/useGuestLimit';
import { SAMPLE_DATA, SAMPLE_EVENT_DATA, getRandomSampleCompany } from '@/lib/sampleData';
import type { InformationSource } from '@/types/analysis';
import type { LetterFormData, LetterMode, LetterStatus, LetterHistory } from '@/types/letter';
import type { AnalysisResult } from '@/types/analysis';
import type { UserOverrides, Citation } from '@/types/generate-v2';
import { createClient } from '@/utils/supabase/client';
import { getErrorDetails, getUserFriendlyError, type ErrorKind } from '@/lib/errorUtils';
import { normalizeLetterText } from '@/lib/textNormalize';
import { resolveTargetUrl } from '@/lib/urlUtils';
import { toast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';

function NewLetterPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const restoreId = searchParams.get('restore');


  const { usage, increment, refetch: refetchGuestUsage } = useGuestLimit();
  const [generatedLetter, setGeneratedLetter] = useState('');
  // バリエーション保持用のステート追加
  const [variations, setVariations] = useState<{ standard: string; emotional: string; consultative: string } | undefined>(undefined);
  const [activeVariation, setActiveVariation] = useState<'standard' | 'emotional' | 'consultative'>('standard');
  // メール生成用ステート
  const [emailData, setEmailData] = useState<{ subject: string; body: string } | undefined>(undefined);

  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<LetterMode>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentLetterId, setCurrentLetterId] = useState<string | undefined>();
  const [currentLetterStatus, setCurrentLetterStatus] = useState<LetterStatus | undefined>();
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [formData, setFormData] = useState<LetterFormData>({
    myCompanyName: '',
    myName: '',
    myServiceDescription: '',
    companyName: '',
    position: '',
    name: '',
    targetUrl: '',
    background: '',
    problem: '',
    solution: '',
    caseStudy: '',
    offer: '',
    freeformInput: '',
    eventUrl: '',
    eventName: '',
    eventDateTime: '',
    eventSpeakers: '',
    invitationReason: '',
    simpleRequirement: '',
  });

  // V2生成フロー用のステート
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingV2, setIsGeneratingV2] = useState(false);
  const [useV2Flow, setUseV2Flow] = useState(true); // デフォルトでV2フローを使用
  const [resolvedTargetUrl, setResolvedTargetUrl] = useState<string | undefined>(undefined);
  const [_urlWarning, _setUrlWarning] = useState<string | null>(null);
  const [generatedSources, setGeneratedSources] = useState<InformationSource[] | undefined>(undefined);
  const [generatedCitations, setGeneratedCitations] = useState<Citation[] | undefined>(undefined);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationErrorKind, setGenerationErrorKind] = useState<ErrorKind | null>(null);
  const [isQuickDrafting, setIsQuickDrafting] = useState(false);
  const [isSampleCooldown, setIsSampleCooldown] = useState(false);
  const [selfCheck, setSelfCheck] = useState<string[] | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);

  // 再分析が必要か判定
  const shouldReanalyze = useCallback((
    prevAnalysis: AnalysisResult,
    inputFormData: LetterFormData,
    targetUrl: string | undefined
  ): boolean => {
    // 以下いずれかが変わったら再分析
    return (
      prevAnalysis.facts?.company_name !== inputFormData.companyName ||
      prevAnalysis.target_url !== targetUrl ||
      prevAnalysis.facts?.person_name !== inputFormData.name ||
      prevAnalysis.facts?.person_position !== inputFormData.position
    );
  }, []);

  // Load profile data and auto-populate form
  useEffect(() => {
    const loadProfileData = async () => {
      if (user && !profileLoaded) {
        try {
          const profile = await getProfile();
          if (profile) {
            setFormData(prev => ({
              ...prev,
              myCompanyName: profile.company_name || '',
              myName: profile.user_name || '',
              myServiceDescription: profile.service_description || '',
            }));
            setProfileLoaded(true);
          }
        } catch (error) {
          devLog.error('Failed to load profile:', error);
        }
      }
    };

    loadProfileData();
  }, [user, profileLoaded]);

  // 制限到達時にモーダルを表示
  useEffect(() => {
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
    }
  }, [usage, user]);

  // 初回訪問時にウェルカムウィザードを表示
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('cxo_welcome_completed');
      if (!completed) {
        setShowWelcome(true);
      }
    }
  }, []);

  const handleWelcomeComplete = useCallback(() => {
    localStorage.setItem('cxo_welcome_completed', '1');
    setShowWelcome(false);
  }, []);

  // V2フロー: 分析を実行して結果を返す（内部用）
  const runAnalysis = useCallback(async (inputFormData: LetterFormData, targetUrl: string | undefined): Promise<AnalysisResult | null> => {
    try {
      // ユーザーノートを構築
      const userNotes = [
        inputFormData.companyName && `企業名: ${inputFormData.companyName}`,
        inputFormData.name && `担当者: ${inputFormData.name}`,
        inputFormData.position && `役職: ${inputFormData.position}`,
        inputFormData.background && `背景・経緯: ${inputFormData.background}`,
        inputFormData.problem && `課題: ${inputFormData.problem}`,
        inputFormData.freeformInput && `追加情報: ${inputFormData.freeformInput}`,
      ].filter(Boolean).join('\n');

      const response = await fetch('/api/analyze-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl || undefined,
          user_notes: userNotes || undefined,
          sender_info: inputFormData.myCompanyName ? {
            company_name: inputFormData.myCompanyName,
            service_description: inputFormData.myServiceDescription || '',
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `分析に失敗しました (${response.status})`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      throw new Error(data.error || '分析結果の取得に失敗しました');
    } catch (error) {
      devLog.error('分析エラー:', error);
      return null;
    }
  }, []);

  // V2フロー: 生成を実行（リトライ対応）
  const executeGenerateV2WithRetry = useCallback(async (
    currentAnalysis: AnalysisResult,
    inputFormData: LetterFormData,
    outputFormat: 'letter' | 'email',
    targetUrl: string | undefined,
    retryCount: number = 0
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/generate-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_result: currentAnalysis,
          user_overrides: {
            company_name: inputFormData.companyName,
            person_name: inputFormData.name,
            person_position: inputFormData.position,
            additional_context: mode === 'consulting'
              ? [
                  inputFormData.productStrength && `強み: ${inputFormData.productStrength}`,
                  inputFormData.solution && `できること: ${inputFormData.solution}`,
                  inputFormData.caseStudy && `実績: ${inputFormData.caseStudy}`,
                  inputFormData.targetChallenges && `課題仮説: ${inputFormData.targetChallenges}`,
                  inputFormData.freeformInput,
                ].filter(Boolean).join('\n')
              : inputFormData.freeformInput,
            target_url: targetUrl,
          },
          sender_info: {
            company_name: inputFormData.myCompanyName,
            department: inputFormData.myDepartment || '',
            name: inputFormData.myName,
            service_description: inputFormData.myServiceDescription,
          },
          mode: mode === 'consulting' ? 'consulting' : 'complete',
          output_format: outputFormat,
        }),
      });

      // 422 URL_FACTS_EMPTY の場合、再分析してリトライ
      if (response.status === 422 && retryCount < 1) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'URL_FACTS_EMPTY') {
          devLog.log('URL_FACTS_EMPTY: 再分析を実行');
          const reanalyzedResult = await runAnalysis(inputFormData, targetUrl);
          if (reanalyzedResult) {
            setAnalysisResult(reanalyzedResult);
            return await executeGenerateV2WithRetry(
              reanalyzedResult,
              inputFormData,
              outputFormat,
              targetUrl,
              retryCount + 1
            );
          }
          // 再分析失敗
          setGenerationError('URLから情報を取得できませんでした。別のURLを試すか、URLなしで生成できます。');
          setGenerationErrorKind('url_not_found');
          return false;
        }
      }

      if (response.status === 429) {
        setShowLimitModal(true);
        refetchGuestUsage();
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // 422 でリトライ済みの場合
        if (response.status === 422 && errorData.error === 'URL_FACTS_EMPTY') {
          setGenerationError('URLから情報を取得できませんでした。別のURLを試すか、URLなしで生成できます。');
          setGenerationErrorKind('url_not_found');
          return false;
        }
        throw new Error(errorData.error || `生成に失敗しました (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // リセット
        setVariations(undefined);
        setEmailData(undefined);
        setGenerationError(null);
        setGenerationErrorKind(null);
        setSelfCheck(undefined);

        if (outputFormat === 'email') {
          // メール形式
          const normalizedEmail = {
            subject: data.data.subjects?.[0] || '件名',
            body: normalizeLetterText(data.data.body),
          };
          setEmailData(normalizedEmail);
          setGeneratedLetter(`件名: ${normalizedEmail.subject}\n\n${normalizedEmail.body}`);
        } else {
          // 手紙形式
          setGeneratedLetter(normalizeLetterText(data.data.body));
        }

        // consultingモードのselfCheck保存
        if (data.data.selfCheck) {
          setSelfCheck(data.data.selfCheck);
        }

        // バリエーションがあればセット（consultingモードではなし）
        if (data.data.variations) {
          setVariations({
            standard: normalizeLetterText(data.data.variations.standard),
            emotional: normalizeLetterText(data.data.variations.emotional),
            consultative: normalizeLetterText(data.data.variations.consultative),
          });
          setActiveVariation('standard');
        }

        // ソースとcitationsを保存
        if (data.data.sources) {
          setGeneratedSources(data.data.sources);
        }
        if (data.data.citations) {
          setGeneratedCitations(data.data.citations);
        }

        // 履歴に保存（sources/citations も含む）
        const contentToSave = data.data.body;
        if (user) {
          const savedLetter = await saveToHistory(inputFormData, contentToSave, mode, {
            sources: data.data.sources,
            citations: data.data.citations,
          });
          if (savedLetter) {
            setCurrentLetterId(savedLetter.id);
            setCurrentLetterStatus(savedLetter.status);
          }
        } else {
          const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
          const savedLetter = saveToGuestHistory(inputFormData, contentToSave, mode);
          setCurrentLetterId(savedLetter.id);
          setCurrentLetterStatus(savedLetter.status);
          window.dispatchEvent(new Event('guest-history-updated'));
        }

        // ゲスト利用回数を更新
        if (!user) {
          increment();
        }

        // 品質スコアが低い場合は警告
        if (data.data.quality && !data.data.quality.passed) {
          devLog.warn('品質スコアが基準を下回りました:', data.data.quality);
        }

        return true;
      } else {
        throw new Error(data.error || '生成結果の取得に失敗しました');
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      devLog.error('V2生成エラー:', errorDetails);
      const friendly = getUserFriendlyError(error, 'generation');
      setGenerationError(friendly.message);
      setGenerationErrorKind(friendly.kind);
      return false;
    }
  }, [user, mode, increment, refetchGuestUsage, runAnalysis]);

  // V2統一生成関数（salesモード用）
  const ensureAnalysisThenGenerateV2 = useCallback(async (
    inputFormData: LetterFormData,
    outputFormat: 'letter' | 'email'
  ) => {
    setIsGenerating(true);
    setIsGeneratingV2(true);
    setGenerationError(null);
    setGenerationErrorKind(null);

    try {
      // 1. 統一されたtargetUrl解決
      const targetUrl = resolveTargetUrl(inputFormData);
      setResolvedTargetUrl(targetUrl);

      // デバッグ情報をconsoleに出力（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        devLog.log('[V2 Analyze] targetUrl resolution:', {
          explicitTargetUrl: inputFormData.targetUrl,
          eventUrl: inputFormData.eventUrl,
          freeformInput: inputFormData.freeformInput?.substring(0, 100),
          resolvedTargetUrl: targetUrl,
        });
      }

      // 2. 分析を実行（analysisResult がない、または主要フィールドが変わった場合）
      let currentAnalysis = analysisResult;
      if (!currentAnalysis || shouldReanalyze(currentAnalysis, inputFormData, targetUrl)) {
        setIsAnalyzing(true);
        const result = await runAnalysis(inputFormData, targetUrl);
        setIsAnalyzing(false);

        if (!result) {
          setGenerationError('分析に失敗しました。入力内容を確認して、もう一度お試しください。');
          setGenerationErrorKind('unknown');
          return;
        }
        currentAnalysis = result;
        setAnalysisResult(result);

        // sourcesを分析結果から保存
        if (result.sources) {
          setGeneratedSources(result.sources);
        }
      }

      // 3. 生成を実行（リトライ対応）
      await executeGenerateV2WithRetry(currentAnalysis, inputFormData, outputFormat, targetUrl);

    } finally {
      setIsGenerating(false);
      setIsGeneratingV2(false);
    }
  }, [analysisResult, shouldReanalyze, runAnalysis, executeGenerateV2WithRetry]);

  // V2フロー: 分析APIを呼び出してモーダルを表示（フォームデータを引数で受け取るバージョン）
  const handleAnalyzeForV2WithFormData = useCallback(async (inputFormData: LetterFormData) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    _setUrlWarning(null);
    setGenerationError(null);
    setGenerationErrorKind(null);

    try {
      // 統一されたtargetUrl解決
      const targetUrl = resolveTargetUrl(inputFormData);
      setResolvedTargetUrl(targetUrl);

      // デバッグ情報をconsoleに出力（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        devLog.log('[V2 Analyze] targetUrl resolution:', {
          explicitTargetUrl: inputFormData.targetUrl,
          eventUrl: inputFormData.eventUrl,
          freeformInput: inputFormData.freeformInput?.substring(0, 100),
          resolvedTargetUrl: targetUrl,
        });
      }

      // URL未入力時は警告を表示（ブロックはしない）
      if (!targetUrl) {
        _setUrlWarning('URLが未入力です。分析精度が低下する可能性があります。');
        devLog.warn('[V2 Analyze] URLが未入力です。分析精度が低下する可能性があります。');
      }

      // ユーザーノートを構築（フォームデータから）
      // Event モード固有フィールドも含める（値があれば自動的に含まれる）
      const userNotes = [
        inputFormData.companyName && `企業名: ${inputFormData.companyName}`,
        inputFormData.department && `部署: ${inputFormData.department}`,
        inputFormData.name && `担当者: ${inputFormData.name}`,
        inputFormData.position && `役職: ${inputFormData.position}`,
        inputFormData.background && `背景・経緯: ${inputFormData.background}`,
        inputFormData.problem && `課題: ${inputFormData.problem}`,
        // Event モード固有フィールド
        inputFormData.invitationReason && `招待理由: ${inputFormData.invitationReason}`,
        inputFormData.eventName && `イベント名: ${inputFormData.eventName}`,
        inputFormData.eventDateTime && `イベント日時: ${inputFormData.eventDateTime}`,
        inputFormData.eventSpeakers && `登壇者: ${inputFormData.eventSpeakers}`,
        inputFormData.eventUrl && `イベントURL: ${inputFormData.eventUrl}`,
        inputFormData.freeformInput && `追加情報: ${inputFormData.freeformInput}`,
      ].filter(Boolean).join('\n');

      const response = await fetch('/api/analyze-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl || undefined,
          user_notes: userNotes || undefined,
          sender_info: inputFormData.myCompanyName ? {
            company_name: inputFormData.myCompanyName,
            service_description: inputFormData.myServiceDescription || '',
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `分析に失敗しました (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setAnalysisResult(data.data);
        setShowAnalysisModal(true);

        // sourcesを分析結果から保存
        if (data.data.sources) {
          setGeneratedSources(data.data.sources);
        }
      } else {
        throw new Error(data.error || '分析結果の取得に失敗しました');
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      devLog.error('分析エラー:', errorDetails);
      const friendly = getUserFriendlyError(error, 'analysis');
      setGenerationError(friendly.message);
      setGenerationErrorKind(friendly.kind);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // V2フロー: 分析APIを呼び出してモーダルを表示
  const _handleAnalyzeForV2 = useCallback(async () => {
    // 送り手情報の入力必須チェック
    if (!formData.myCompanyName || !formData.myName || !formData.myServiceDescription) {
      const errors: Record<string, string> = {};
      if (!formData.myCompanyName) errors.myCompanyName = '会社名を入力してください';
      if (!formData.myName) errors.myName = '氏名を入力してください';
      if (!formData.myServiceDescription) errors.myServiceDescription = 'サービス概要を入力してください';
      setFormErrors(errors);
      return;
    }

    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    await handleAnalyzeForV2WithFormData(formData);
  }, [formData, usage, user, handleAnalyzeForV2WithFormData]);

  // salesモード用：クイック下書き生成（モーダルなしで一括生成）
  // 2レーン統合：クイック下書き生成（sales/event共通）
  const handleQuickDraft = useCallback(async () => {
    // バリデーション：企業名必須（eventはイベントURLも推奨だが必須ではない）
    const errors: Record<string, string> = {};
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      errors.companyName = '相手企業名またはURLを入力してください';
    }
    if (!formData.myServiceDescription) {
      errors.myServiceDescription = '自社サービス概要を入力してください';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    setIsQuickDrafting(true);
    try {
      // V2統一生成（分析+生成を一括実行、モーダルなし）
      await ensureAnalysisThenGenerateV2(formData, 'letter');
    } finally {
      setIsQuickDrafting(false);
    }
  }, [formData, usage, user, ensureAnalysisThenGenerateV2]);

  // 2レーン統合：根拠付き生成（分析→モーダル→生成、sales/event共通）
  const handleAnalyzeAndGenerate = useCallback(async () => {
    // バリデーション：企業名必須
    const errors: Record<string, string> = {};
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      errors.companyName = '相手企業名またはURLを入力してください';
    }
    if (!formData.myServiceDescription) {
      errors.myServiceDescription = '自社サービス概要を入力してください';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    // 分析→モーダル表示（モーダル内で生成ボタン押下後に生成実行）
    await handleAnalyzeForV2WithFormData(formData);
  }, [formData, usage, user, handleAnalyzeForV2WithFormData]);

  // V2フロー: 分析結果を使ってレター生成
  const handleGenerateV2 = useCallback(async (overrides: UserOverrides, generateMode: 'draft' | 'complete' | 'event' | 'consulting') => {
    if (!analysisResult) return;

    setIsGeneratingV2(true);
    setIsGenerating(true);
    setModalError(null);

    // eventモードの場合、formDataからイベント情報をマージ
    // consultingモードの場合、追加コンテキストをマージ
    let finalOverrides: UserOverrides;
    if (generateMode === 'event') {
      finalOverrides = {
        ...overrides,
        event_name: formData.eventName || overrides.event_name,
        event_datetime: formData.eventDateTime || overrides.event_datetime,
        event_speakers: formData.eventSpeakers || overrides.event_speakers,
      };
    } else if (generateMode === 'consulting') {
      finalOverrides = {
        ...overrides,
        additional_context: [
          formData.productStrength && `強み: ${formData.productStrength}`,
          formData.solution && `できること: ${formData.solution}`,
          formData.caseStudy && `実績: ${formData.caseStudy}`,
          formData.targetChallenges && `課題仮説: ${formData.targetChallenges}`,
          overrides.additional_context,
        ].filter(Boolean).join('\n'),
      };
    } else {
      finalOverrides = overrides;
    }

    try {
      const response = await fetch('/api/generate-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_result: analysisResult,
          user_overrides: finalOverrides,
          sender_info: {
            company_name: formData.myCompanyName,
            department: '',
            name: formData.myName,
            service_description: formData.myServiceDescription,
          },
          mode: generateMode,
          output_format: 'letter',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setShowLimitModal(true);
          refetchGuestUsage();
          return;
        }
        throw new Error(errorData.error || `生成に失敗しました (${response.status})`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // リセット
        setVariations(undefined);
        setEmailData(undefined);
        setSelfCheck(undefined);
        setGenerationError(null);
        setGenerationErrorKind(null);
        setModalError(null);

        // 本文をセット
        setGeneratedLetter(normalizeLetterText(data.data.body));

        // consultingモードのselfCheck保存
        if (data.data.selfCheck) {
          setSelfCheck(data.data.selfCheck);
        }

        // バリエーションがあればセット（consultingモードではなし）
        if (data.data.variations) {
          setVariations({
            standard: normalizeLetterText(data.data.variations.standard),
            emotional: normalizeLetterText(data.data.variations.emotional),
            consultative: normalizeLetterText(data.data.variations.consultative),
          });
          setActiveVariation('standard');
        }

        // 履歴に保存（sources/citations も含む）
        const contentToSave = data.data.body;
        if (user) {
          const savedLetter = await saveToHistory(formData, contentToSave, mode, {
            sources: data.data.sources,
            citations: data.data.citations,
          });
          if (savedLetter) {
            setCurrentLetterId(savedLetter.id);
            setCurrentLetterStatus(savedLetter.status);
          }
        } else {
          const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
          const savedLetter = saveToGuestHistory(formData, contentToSave, mode);
          setCurrentLetterId(savedLetter.id);
          setCurrentLetterStatus(savedLetter.status);
          window.dispatchEvent(new Event('guest-history-updated'));
        }

        // ゲスト利用回数を更新
        if (!user) {
          increment();
        }

        // モーダルを閉じる
        setShowAnalysisModal(false);

        // 品質スコアが低い場合は警告
        if (data.data.quality && !data.data.quality.passed) {
          devLog.warn('品質スコアが基準を下回りました:', data.data.quality);
        }
      } else {
        throw new Error(data.error || '生成結果の取得に失敗しました');
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      devLog.error('V2生成エラー:', errorDetails);
      const friendly = getUserFriendlyError(error, 'generation');
      // モーダル内にエラーを表示（ページ側ではなく）
      setModalError(friendly.message);
    } finally {
      setIsGeneratingV2(false);
      setIsGenerating(false);
    }
  }, [analysisResult, formData, mode, user, increment, refetchGuestUsage]);

  // Restore letter from history
  useEffect(() => {
    const restoreLetter = async () => {
      if (!restoreId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('letters')
          .select('*')
          .eq('id', restoreId)
          .single();

        if (error || !data) {
          devLog.error('Failed to fetch letter:', error);
          return;
        }

        // Restore form data
        if (data.inputs) {
          setFormData(data.inputs as LetterFormData);
        }

        // Restore generated content
        if (data.content) {
          setGeneratedLetter(normalizeLetterText(data.content));
        }

        // Restore mode
        if (data.mode) {
          setMode(data.mode as LetterMode);
        }

        // Restore letter ID and status
        setCurrentLetterId(data.id);
        setCurrentLetterStatus(data.status as LetterStatus);

        // Restore email data if available
        if (data.email_content) {
          setEmailData(data.email_content as { subject: string; body: string });
        }
      } catch (error) {
        devLog.error('Error restoring letter:', error);
      }
    };

    restoreLetter();
  }, [restoreId]);


  const handleRestore = (history: LetterHistory) => {
    setFormData(history.inputs);
    setGeneratedLetter(history.content);
    setCurrentLetterId(history.id);
    setCurrentLetterStatus(history.status);
    // sources/citations を復元（履歴に保存されている場合）
    setGeneratedSources(history.sources);
    setGeneratedCitations(history.citations);
  };

  const handleSaveOnly = async () => {
    if (user) {
      // 履歴に保存 (Supabase) - sources/citations も含む
      const savedLetter = await saveToHistory(formData, generatedLetter, mode, {
        sources: generatedSources,
        citations: generatedCitations,
      });
      if (savedLetter) {
        setCurrentLetterId(savedLetter.id);
        setCurrentLetterStatus(savedLetter.status);
        toast({ title: '履歴に保存しました', type: 'success' });
      }
    } else {
      // Guest: Save to LocalStorage
      const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
      const savedLetter = saveToGuestHistory(formData, generatedLetter, mode);
      setCurrentLetterId(savedLetter.id);
      setCurrentLetterStatus(savedLetter.status);

      // Notify sidebar
      window.dispatchEvent(new Event('guest-history-updated'));
      toast({ title: 'ブラウザに一時保存しました', type: 'success' });
    }
  }

  const handleResetOnly = () => {
    // 生成結果があり、かつ未保存の場合の本来のチェックロジックが必要だが、
    // 現在の仕様では「生成結果が表示されており」かつ「未保存」かどうかの判定が難しい
    // (savedLetterIdがある＝保存済み、だが、直後に編集されている可能性もある)
    // ここではシンプルに「生成結果がある」場合に確認を出す
    if (generatedLetter) {
      if (!confirm('保存されていませんが、リセットしますか？')) {
        return;
      }
    }

    // フォームリセット
    setFormData({
      myCompanyName: '',
      myName: '',
      myServiceDescription: '',
      companyName: '',
      position: '',
      name: '',
      targetUrl: '',
      background: '',
      problem: '',
      solution: '',
      caseStudy: '',
      offer: '',
      freeformInput: '',
      eventUrl: '',
      eventName: '',
      eventDateTime: '',
      eventSpeakers: '',
      invitationReason: '',
      simpleRequirement: '',
    });

    setGeneratedLetter('');
    setCurrentLetterId(undefined);
    setCurrentLetterStatus(undefined);
    setVariations(undefined);
    setEmailData(undefined);
    setGeneratedSources(undefined);
    setGeneratedCitations(undefined);
    setSelfCheck(undefined);
  };

  const handleSampleExperience = async () => {
    // 連打防止（2秒クールダウン）
    if (isSampleCooldown) return;

    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    setIsSampleCooldown(true);

    // ランダム会社を取得（Sales/Event共通）
    const randomCompany = getRandomSampleCompany();

    // モードに応じてフォームデータを構築
    let sampleFormData: LetterFormData;

    if (mode === 'event') {
      const eventSample = SAMPLE_EVENT_DATA;

      sampleFormData = {
        myCompanyName: eventSample.myCompanyName,
        myName: eventSample.myName,
        myServiceDescription: eventSample.myServiceDescription,
        companyName: randomCompany.companyName,
        department: eventSample.department,
        position: eventSample.position,
        name: eventSample.name,
        targetUrl: randomCompany.targetUrl,
        background: '',
        problem: '',
        solution: '',
        caseStudy: '',
        offer: '',
        freeformInput: '',
        eventUrl: eventSample.eventUrl,
        eventName: eventSample.eventName,
        eventDateTime: eventSample.eventDateTime,
        eventSpeakers: eventSample.eventSpeakers,
        invitationReason: eventSample.invitationReason,
        simpleRequirement: '',
      };
    } else {
      // salesモード: ランダムな実在企業サンプル
      // 自社情報のみSAMPLE_DATAから使用し、ターゲット固有フィールドはクリア
      // （URLベースの分析で自動取得するため）
      const salesSample = SAMPLE_DATA;
      sampleFormData = {
        myCompanyName: salesSample.myCompanyName,
        myName: salesSample.myName,
        myServiceDescription: salesSample.myServiceDescription,
        companyName: randomCompany.companyName,
        department: salesSample.department,
        position: salesSample.position,
        name: salesSample.name,
        targetUrl: randomCompany.targetUrl,
        background: '',
        problem: '',
        solution: '',
        caseStudy: '',
        offer: '',
        freeformInput: '',
        eventUrl: '',
        eventName: '',
        eventDateTime: '',
        eventSpeakers: '',
        invitationReason: '',
        simpleRequirement: '',
      };
    }

    // フォームにデータをセット
    setFormData(sampleFormData);

    try {
      // サンプルは常にV2フロー（分析→モーダル→生成）を使用
      await handleAnalyzeForV2WithFormData(sampleFormData);
    } finally {
      // 2秒後にクールダウン解除
      setTimeout(() => setIsSampleCooldown(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* モード切り替えUI */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            {/* 履歴ボタン（常に表示） */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-md transition-all font-medium ${isSidebarOpen
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              aria-label={isSidebarOpen ? '履歴を閉じる' : '履歴を開く'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">履歴</span>
            </button>

            <div className="flex gap-1 flex-1">
              <button
                onClick={() => setMode('sales')}
                className={`px-6 py-3 font-medium transition-all rounded-t-md ${mode === 'sales'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                📧 セールスレター
              </button>
              <button
                onClick={() => setMode('event')}
                className={`px-6 py-3 font-medium transition-all rounded-t-md ${mode === 'event'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                🎫 イベント招待
              </button>
              <button
                onClick={() => setMode('consulting')}
                className={`px-6 py-3 font-medium transition-all rounded-t-md ${mode === 'consulting'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                💬 相談型レター
              </button>
            </div>

            {/* V2フロートグル（eventモード時のみ表示、salesは常にV2固定） */}
            {mode === 'event' && (
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useV2Flow}
                    onChange={(e) => setUseV2Flow(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-700"></div>
                  <span className="ml-2 text-sm font-medium text-slate-700 hidden sm:inline">高品質モード</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ゲスト利用制限インジケーター */}
      {!user && usage && (
        <div className="bg-amber-50 border-b border-amber-200 py-2">
          <div className="container mx-auto px-4 flex justify-center items-center gap-2 text-sm text-amber-900">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">ゲスト利用中：本日あと <span className="font-bold text-lg">{usage.remaining}</span> 回</span>
            {usage.isLimitReached ? (
              <Link href="/login" className="ml-2 underline font-bold hover:text-amber-700">
                ログインして制限を解除
              </Link>
            ) : (
              <Link href="/login" className="ml-2 text-amber-800 hover:text-amber-900 font-medium">
                無料登録で10回/日に増やす &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3カラムレイアウト（自然なスクロール） */}
      <main className="container mx-auto px-4 py-6">
        {/* ウェルカムウィザード（初回のみ） */}
        {showWelcome && (
          <WelcomeWizard
            onComplete={handleWelcomeComplete}
            onSampleExperience={handleSampleExperience}
            onModeChange={setMode}
          />
        )}

        <div className="relative">
          {/* モバイル用背景オーバーレイ */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="サイドバーを閉じる"
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
            {/* 左側: 履歴サイドバー（Sticky追従 + Collapsible） */}
            <div
              className={`
                fixed md:relative top-0 left-0 h-full md:h-auto
                md:col-span-2 md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto
                bg-slate-50 md:bg-transparent z-50 md:z-10
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${!isSidebarOpen ? 'md:hidden' : ''}
                w-80 md:w-auto
              `}
            >
              <HistorySidebar
                onRestore={handleRestore}
                onSampleExperience={handleSampleExperience}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                refreshTrigger={refreshHistoryTrigger}
                selectedId={currentLetterId}
              />
            </div>

            {/* 中央: 入力フォーム（自然に伸びる） */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} transition-all duration-300`}>
              {/* 生成エラー表示 */}
              {generationError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <span className="text-sm text-red-800">{generationError}</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(generationErrorKind === 'network' || generationErrorKind === 'timeout' || generationErrorKind === 'server' || generationErrorKind === 'unknown') && (
                          <button
                            onClick={() => {
                              setGenerationError(null);
                              setGenerationErrorKind(null);
                            }}
                            className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                          >
                            もう一度試す
                          </button>
                        )}
                        {(generationErrorKind === 'url_not_found' || generationErrorKind === 'url_blocked' || generationErrorKind === 'timeout') && (
                          <button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, targetUrl: '' }));
                              setGenerationError(null);
                              setGenerationErrorKind(null);
                            }}
                            className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                          >
                            URLなしで生成する
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setGenerationError(null); setGenerationErrorKind(null); }}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <InputForm
                mode={mode}
                setIsGenerating={setIsGenerating}
                formData={formData}
                setFormData={setFormData}
                onSampleFill={handleSampleExperience}
                onReset={handleResetOnly}
                disabled={!user && usage?.isLimitReached}
                onGenerateV2={ensureAnalysisThenGenerateV2}
                onQuickDraft={handleQuickDraft}
                onAnalyzeAndGenerate={handleAnalyzeAndGenerate}
                isQuickDrafting={isQuickDrafting}
                isAnalyzing={isAnalyzing}
                guestRemaining={usage?.remaining}
                guestLimit={usage?.limit}
                isLoggedIn={!!user}
                formErrors={formErrors}
                onClearError={(field) => setFormErrors(prev => { const next = { ...prev }; delete next[field]; return next; })}
              />
            </div>

            {/* 右側: プレビューエリア（Sticky追従） */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10 transition-all duration-300`}>

              <PreviewArea
                content={generatedLetter}
                onContentChange={(newContent) => {
                  setGeneratedLetter(newContent);
                  if (variations) {
                    setVariations({
                      ...variations,
                      [activeVariation]: newContent
                    });
                  }
                }}
                isGenerating={isGenerating}
                isAnalyzing={isAnalyzing}
                currentLetterId={currentLetterId}
                currentStatus={currentLetterStatus}
                onStatusChange={() => setRefreshHistoryTrigger(prev => prev + 1)}
                variations={mode !== 'consulting' ? variations : undefined}
                activeVariation={activeVariation}
                onVariationSelect={(variation) => {
                  setActiveVariation(variation);
                  if (variations) {
                    setGeneratedLetter(variations[variation]);
                  }
                }}
                emailData={emailData}
                onEmailChange={(newEmail) => {
                  setEmailData(newEmail);
                  setGeneratedLetter(`件名: ${newEmail.subject}\n\n${newEmail.body}`);
                }}
                onSave={handleSaveOnly}
                sources={generatedSources}
                citations={generatedCitations}
                hasUrl={Boolean(resolvedTargetUrl || formData.targetUrl)}
                selfCheck={selfCheck}
                letterMode={mode}
                onSampleFill={handleSampleExperience}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 制限到達モーダル（損失回避フレーミング） */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700"></div>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">あと少しで完成です！</h3>
            <p className="text-stone-600 mb-6 leading-relaxed text-center">
              無料登録すると今すぐ続きを作成できます。<br />
              <span className="text-xs text-stone-400">30秒で完了・クレジットカード不要</span>
            </p>

            {/* 登録メリット */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>1日<strong>10回</strong>まで生成可能（ゲストの3倍以上）</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>作成したレターの<strong>履歴を保存</strong>して再利用</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>AI自動編集</strong>で文面を何度でも調整</span>
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

      {/* V2分析プレビューモーダル */}
      <AnalysisPreviewModal
        isOpen={showAnalysisModal}
        onClose={() => { setShowAnalysisModal(false); setModalError(null); }}
        analysisResult={analysisResult}
        onConfirm={handleGenerateV2}
        isLoading={isGeneratingV2}
        hasUrl={Boolean(resolvedTargetUrl)}
        letterMode={mode}
        error={modalError}
        onClearError={() => setModalError(null)}
        onDraftFallback={() => {
          setModalError(null);
          handleGenerateV2({}, 'draft');
        }}
      />
    </div>
  );
}

export default function NewLetterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    }>
      <NewLetterPageContent />
    </Suspense>
  );
}
