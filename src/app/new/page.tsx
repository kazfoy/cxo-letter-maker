'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { AnalysisPreviewModal } from '@/components/AnalysisPreviewModal';
import { saveToHistory } from '@/lib/supabaseHistoryUtils';
import { getProfile } from '@/lib/profileUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestLimit } from '@/hooks/useGuestLimit';
import { SAMPLE_DATA, SAMPLE_EVENT_DATA } from '@/lib/sampleData';
import type { InformationSource } from '@/types/analysis';
import type { LetterFormData, LetterMode, LetterStatus, LetterHistory } from '@/types/letter';
import type { AnalysisResult } from '@/types/analysis';
import type { UserOverrides, Citation } from '@/types/generate-v2';
import { createClient } from '@/utils/supabase/client';
import { getErrorDetails } from '@/lib/errorUtils';
import { normalizeLetterText } from '@/lib/textNormalize';
import { resolveTargetUrl } from '@/lib/urlUtils';

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
  const [isQuickDrafting, setIsQuickDrafting] = useState(false);

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
          console.error('Failed to load profile:', error);
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
      console.error('分析エラー:', error);
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
            additional_context: inputFormData.freeformInput,
            target_url: targetUrl,
          },
          sender_info: {
            company_name: inputFormData.myCompanyName,
            department: '',
            name: inputFormData.myName,
            service_description: inputFormData.myServiceDescription,
          },
          mode: 'complete',
          output_format: outputFormat,
        }),
      });

      // 422 URL_FACTS_EMPTY の場合、再分析してリトライ
      if (response.status === 422 && retryCount < 1) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'URL_FACTS_EMPTY') {
          console.log('URL_FACTS_EMPTY: 再分析を実行');
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
          setGenerationError('URLから根拠を抽出できませんでした。別のURLを試してください。');
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
          setGenerationError('URLから根拠を抽出できませんでした。別のURLを試してください。');
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

        // バリエーションがあればセット
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

        // 履歴に保存
        const contentToSave = data.data.body;
        if (user) {
          const savedLetter = await saveToHistory(inputFormData, contentToSave, mode);
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
          console.warn('品質スコアが基準を下回りました:', data.data.quality);
        }

        return true;
      } else {
        throw new Error(data.error || '生成結果の取得に失敗しました');
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      console.error('V2生成エラー:', errorDetails);
      setGenerationError(`生成に失敗しました: ${errorDetails.message}`);
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

    try {
      // 1. 統一されたtargetUrl解決
      const targetUrl = resolveTargetUrl(inputFormData);
      setResolvedTargetUrl(targetUrl);

      // デバッグ情報をconsoleに出力（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        console.log('[V2 Analyze] targetUrl resolution:', {
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
          setGenerationError('分析に失敗しました。入力内容を確認してください。');
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

    try {
      // 統一されたtargetUrl解決
      const targetUrl = resolveTargetUrl(inputFormData);
      setResolvedTargetUrl(targetUrl);

      // デバッグ情報をconsoleに出力（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        console.log('[V2 Analyze] targetUrl resolution:', {
          explicitTargetUrl: inputFormData.targetUrl,
          eventUrl: inputFormData.eventUrl,
          freeformInput: inputFormData.freeformInput?.substring(0, 100),
          resolvedTargetUrl: targetUrl,
        });
      }

      // URL未入力時は警告を表示（ブロックはしない）
      if (!targetUrl) {
        _setUrlWarning('URLが未入力です。分析精度が低下する可能性があります。');
        console.warn('[V2 Analyze] URLが未入力です。分析精度が低下する可能性があります。');
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
      console.error('分析エラー:', errorDetails);
      alert(`分析に失敗しました: ${errorDetails.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // V2フロー: 分析APIを呼び出してモーダルを表示
  const _handleAnalyzeForV2 = useCallback(async () => {
    // 送り手情報の入力必須チェック
    if (!formData.myCompanyName || !formData.myName || !formData.myServiceDescription) {
      alert('送り手情報（会社名・氏名・サービス説明）を入力してください');
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
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      alert('相手企業名またはURLを入力してください');
      return;
    }
    // サービス概要は必須
    if (!formData.myServiceDescription) {
      alert('自社サービス概要を入力してください');
      return;
    }

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
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      alert('相手企業名またはURLを入力してください');
      return;
    }
    // サービス概要は必須
    if (!formData.myServiceDescription) {
      alert('自社サービス概要を入力してください');
      return;
    }

    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    // 分析→モーダル表示（モーダル内で生成ボタン押下後に生成実行）
    await handleAnalyzeForV2WithFormData(formData);
  }, [formData, usage, user, handleAnalyzeForV2WithFormData]);

  // V2フロー: 分析結果を使ってレター生成
  const handleGenerateV2 = useCallback(async (overrides: UserOverrides, generateMode: 'draft' | 'complete') => {
    if (!analysisResult) return;

    setIsGeneratingV2(true);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_result: analysisResult,
          user_overrides: overrides,
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

        // 本文をセット
        setGeneratedLetter(normalizeLetterText(data.data.body));

        // バリエーションがあればセット
        if (data.data.variations) {
          setVariations({
            standard: normalizeLetterText(data.data.variations.standard),
            emotional: normalizeLetterText(data.data.variations.emotional),
            consultative: normalizeLetterText(data.data.variations.consultative),
          });
          setActiveVariation('standard');
        }

        // 履歴に保存
        const contentToSave = data.data.body;
        if (user) {
          const savedLetter = await saveToHistory(formData, contentToSave, mode);
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
          console.warn('品質スコアが基準を下回りました:', data.data.quality);
        }
      } else {
        throw new Error(data.error || '生成結果の取得に失敗しました');
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      console.error('V2生成エラー:', errorDetails);
      alert(`生成に失敗しました: ${errorDetails.message}`);
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
          console.error('Failed to fetch letter:', error);
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
        console.error('Error restoring letter:', error);
      }
    };

    restoreLetter();
  }, [restoreId]);

  const handleGenerate = async (response: import('@/types/letter').GenerateResponse, data: LetterFormData) => {
    // リセット
    setVariations(undefined);
    setEmailData(undefined);
    setGeneratedLetter('');

    let contentToSave = '';

    if (response.email) {
      const normalizedEmail = {
        subject: response.email.subject,
        body: normalizeLetterText(response.email.body),
      };
      setEmailData(normalizedEmail);
      // メールモードの場合は本文を保存するのが一般的だが、履歴には件名も含めたいかもしれない。
      // 一旦、本文をメインコンテンツとして保存し、詳細はJSONなどに保存すべきだが、
      // 既存の履歴DB構造(content: text)に合わせるため、"件名: ...\n\n本文..." の形式で保存するか、
      // あるいはメール本文のみ保存するか。
      // ここではわかりやすく結合して保存する。
      contentToSave = `件名: ${normalizedEmail.subject}\n\n${normalizedEmail.body}`;
      setGeneratedLetter(contentToSave); // プレビュー用には使わないが、一応セット
    } else {
      const letterText = normalizeLetterText(response.letter);
      setGeneratedLetter(letterText);
      contentToSave = letterText;

      // バリエーションがあれば保存
      if (response.variations) {
        setVariations({
          standard: normalizeLetterText(response.variations.standard),
          emotional: normalizeLetterText(response.variations.emotional),
          consultative: normalizeLetterText(response.variations.consultative),
        });
        setActiveVariation('standard'); // 生成後は標準をセット
      }
    }

    // 履歴に保存
    if (user) {
      const savedLetter = await saveToHistory(data, contentToSave, mode);
      if (savedLetter) {
        setCurrentLetterId(savedLetter.id);
        setCurrentLetterStatus(savedLetter.status);
      }
    } else {
      // Guest: Save to LocalStorage
      const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
      const savedLetter = saveToGuestHistory(data, contentToSave, mode);
      setCurrentLetterId(savedLetter.id);
      setCurrentLetterStatus(savedLetter.status);

      // Notify sidebar
      window.dispatchEvent(new Event('guest-history-updated'));
      window.dispatchEvent(new StorageEvent('storage', { key: 'cxo_guest_history' }));
    }

    // ゲスト利用回数を更新
    if (!user) {
      increment();
    }
  };



  const handleRestore = (history: LetterHistory) => {
    setFormData(history.inputs);
    setGeneratedLetter(history.content);
    setCurrentLetterId(history.id);
    setCurrentLetterStatus(history.status);
  };

  const handleSaveOnly = async () => {
    if (user) {
      // 履歴に保存 (Supabase)
      const savedLetter = await saveToHistory(formData, generatedLetter, mode);
      if (savedLetter) {
        setCurrentLetterId(savedLetter.id);
        setCurrentLetterStatus(savedLetter.status);
        alert('履歴に保存しました');
      }
    } else {
      // Guest: Save to LocalStorage
      const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
      const savedLetter = saveToGuestHistory(formData, generatedLetter, mode);
      setCurrentLetterId(savedLetter.id);
      setCurrentLetterStatus(savedLetter.status);

      // Notify sidebar
      window.dispatchEvent(new Event('guest-history-updated'));
      alert('ブラウザに一時保存しました');
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
  };

  const handleSampleExperience = async () => {
    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

    // URLの決定（ユーザー入力優先）
    const currentUrl = formData.targetUrl?.trim();

    // モードに応じてフォームデータを構築
    let sampleFormData: LetterFormData;

    if (mode === 'event') {
      const eventSample = SAMPLE_EVENT_DATA;
      sampleFormData = {
        myCompanyName: eventSample.myCompanyName,
        myName: eventSample.myName,
        myServiceDescription: eventSample.myServiceDescription,
        companyName: eventSample.companyName,
        department: eventSample.department,
        position: eventSample.position,
        name: eventSample.name,
        targetUrl: currentUrl || eventSample.targetUrl || '',
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
      // salesモード: 実在企業サンプル（トヨタ自動車）
      const salesSample = SAMPLE_DATA;
      sampleFormData = {
        myCompanyName: salesSample.myCompanyName,
        myName: salesSample.myName,
        myServiceDescription: salesSample.myServiceDescription,
        companyName: salesSample.companyName,
        department: salesSample.department,
        position: salesSample.position,
        name: salesSample.name,
        targetUrl: currentUrl || salesSample.targetUrl || '',
        background: salesSample.background,
        problem: salesSample.problem,
        solution: salesSample.solution,
        caseStudy: salesSample.caseStudy,
        offer: salesSample.offer,
        freeformInput: salesSample.freeformInput,
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

    // サンプルは常にV2フロー（分析→モーダル→生成）を使用
    await handleAnalyzeForV2WithFormData(sampleFormData);
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                📧 セールスレター
              </button>
              <button
                onClick={() => setMode('event')}
                className={`px-6 py-3 font-medium transition-all rounded-t-md ${mode === 'event'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                🎫 イベント招待
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
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">ゲスト利用中：本日あと <span className="font-bold text-lg">{usage.remaining}</span> 回</span>
            {usage.isLimitReached && (
              <Link href="/login" className="ml-2 underline hover:text-amber-700">
                ログインして制限を解除
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3カラムレイアウト（自然なスクロール） */}
      <main className="container mx-auto px-4 py-6">
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
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-800">{generationError}</span>
                    <button
                      onClick={() => setGenerationError(null)}
                      className="ml-auto text-red-500 hover:text-red-700"
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
                onGenerate={handleGenerate}
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
              />
            </div>

            {/* 右側: プレビューエリア（Sticky追従） */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10 transition-all duration-300`}>

              <PreviewArea
                content={generatedLetter}
                onContentChange={(newContent) => {
                  setGeneratedLetter(newContent);
                  // 編集されたら、現在のバリエーションの内容も更新しておく（タブ切り替えで戻れるようにするかは要検討だが、
                  // ここではシンプルに「現在表示中のバリエーション」の中身も更新する挙動にする）
                  if (variations) {
                    setVariations({
                      ...variations,
                      [activeVariation]: newContent
                    });
                  }
                }}
                isGenerating={isGenerating}
                currentLetterId={currentLetterId}
                currentStatus={currentLetterStatus}

                onStatusChange={() => setRefreshHistoryTrigger(prev => prev + 1)}
                variations={variations}
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
              />
            </div>
          </div>
        </div>
      </main>

      {/* 制限到達モーダル */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">本日のゲスト枠を使い切りました</h3>
            <p className="text-slate-600 mb-8 leading-relaxed">
              無料会員登録すると、1日10回まで作成できます。<br />
              さらに、生成履歴の保存や、より高度な機能も利用可能です。
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105"
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

      {/* V2分析プレビューモーダル */}
      <AnalysisPreviewModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        analysisResult={analysisResult}
        onConfirm={handleGenerateV2}
        isLoading={isGeneratingV2}
        hasUrl={Boolean(resolvedTargetUrl)}
      />
    </div>
  );
}

export default function NewLetterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    }>
      <NewLetterPageContent />
    </Suspense>
  );
}
