'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestLimit } from '@/hooks/useGuestLimit';
import { saveToHistory } from '@/lib/supabaseHistoryUtils';
import { SAMPLE_DATA, SAMPLE_EVENT_DATA } from '@/lib/sampleData';
import { getRandomPrecomputedSample, generateDraftLetter } from '@/lib/sampleLetters';
import { getErrorDetails, getUserFriendlyError } from '@/lib/errorUtils';
import { normalizeLetterText } from '@/lib/textNormalize';
import { resolveTargetUrl } from '@/lib/urlUtils';
import { toast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';
import type { LetterFormData } from '@/types/letter';
import type { AnalysisResult } from '@/types/analysis';
import type { UserOverrides } from '@/types/generate-v2';

export function useLetterActions() {
  const { user } = useAuth();
  const router = useRouter();
  const { usage, increment, refetch: refetchGuestUsage } = useGuestLimit();

  const store = useLetterStore();
  const ui = useUiStore();

  const isDemoModeRef = useRef(false);

  // Keep ref in sync with store
  const syncDemoRef = useCallback((v: boolean) => {
    isDemoModeRef.current = v;
    store.setIsDemoMode(v);
  }, [store]);

  const shouldReanalyze = useCallback(
    (prevAnalysis: AnalysisResult, inputFormData: LetterFormData, targetUrl: string | undefined): boolean => {
      return (
        prevAnalysis.facts?.company_name !== inputFormData.companyName ||
        prevAnalysis.target_url !== targetUrl ||
        prevAnalysis.facts?.person_name !== inputFormData.name ||
        prevAnalysis.facts?.person_position !== inputFormData.position
      );
    },
    [],
  );

  const runAnalysis = useCallback(
    async (inputFormData: LetterFormData, targetUrl: string | undefined): Promise<AnalysisResult | null> => {
      try {
        const userNotes = [
          inputFormData.companyName && `企業名: ${inputFormData.companyName}`,
          inputFormData.name && `担当者: ${inputFormData.name}`,
          inputFormData.position && `役職: ${inputFormData.position}`,
          inputFormData.background && `背景・経緯: ${inputFormData.background}`,
          inputFormData.problem && `課題: ${inputFormData.problem}`,
          inputFormData.freeformInput && `追加情報: ${inputFormData.freeformInput}`,
        ]
          .filter(Boolean)
          .join('\n');

        const response = await fetch('/api/analyze-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_url: targetUrl || undefined,
            user_notes: userNotes || undefined,
            sender_info: inputFormData.myCompanyName
              ? {
                  company_name: inputFormData.myCompanyName,
                  service_description: inputFormData.myServiceDescription || '',
                }
              : undefined,
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
    },
    [],
  );

  const executeGenerateV2WithRetry = useCallback(
    async (
      currentAnalysis: AnalysisResult,
      inputFormData: LetterFormData,
      outputFormat: 'letter' | 'email',
      targetUrl: string | undefined,
      retryCount: number = 0,
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
              cxo_insight: inputFormData.cxoInsight || undefined,
              mutual_connection: inputFormData.mutualConnection || undefined,
            },
            sender_info: {
              company_name: inputFormData.myCompanyName,
              department: inputFormData.myDepartment || '',
              name: inputFormData.myName,
              service_description: inputFormData.myServiceDescription,
            },
            mode: 'complete',
            output_format: outputFormat,
            ...(isDemoModeRef.current ? { is_sample: true } : {}),
          }),
        });

        if (response.status === 422 && retryCount < 1) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error === 'URL_FACTS_EMPTY') {
            devLog.log('URL_FACTS_EMPTY: 再分析を実行');
            const reanalyzedResult = await runAnalysis(inputFormData, targetUrl);
            if (reanalyzedResult) {
              store.setAnalysisResult(reanalyzedResult);
              return await executeGenerateV2WithRetry(
                reanalyzedResult,
                inputFormData,
                outputFormat,
                targetUrl,
                retryCount + 1,
              );
            }
            store.setGenerationError('URLから情報を取得できませんでした。別のURLを試すか、URLなしで生成できます。');
            store.setGenerationErrorKind('url_not_found');
            return false;
          }
        }

        if (response.status === 429) {
          ui.setShowLimitModal(true);
          refetchGuestUsage();
          return false;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 422 && errorData.error === 'URL_FACTS_EMPTY') {
            store.setGenerationError('URLから情報を取得できませんでした。別のURLを試すか、URLなしで生成できます。');
            store.setGenerationErrorKind('url_not_found');
            return false;
          }
          throw new Error(errorData.error || `生成に失敗しました (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          store.resetGeneration();

          if (outputFormat === 'email') {
            const normalizedEmail = {
              subject: data.data.subjects?.[0] || '件名',
              body: normalizeLetterText(data.data.body),
            };
            store.setEmailData(normalizedEmail);
            store.setGeneratedLetter(`件名: ${normalizedEmail.subject}\n\n${normalizedEmail.body}`);
          } else {
            store.setGeneratedLetter(normalizeLetterText(data.data.body));
          }

          if (data.data.variations) {
            store.setVariations({
              standard: normalizeLetterText(data.data.variations.standard),
              emotional: normalizeLetterText(data.data.variations.emotional),
              consultative: normalizeLetterText(data.data.variations.consultative),
            });
            store.setActiveVariation('standard');
          }

          if (data.data.sources) {
            store.setGeneratedSources(data.data.sources);
          }
          if (data.data.citations) {
            store.setGeneratedCitations(data.data.citations);
          }

          // Save to history
          const contentToSave = data.data.body;
          if (user) {
            const savedLetter = await saveToHistory(inputFormData, contentToSave, store.mode, {
              sources: data.data.sources,
              citations: data.data.citations,
            });
            if (savedLetter) {
              store.setCurrentLetterId(savedLetter.id);
              store.setCurrentLetterStatus(savedLetter.status);
            }
          } else {
            const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
            const savedLetter = saveToGuestHistory(inputFormData, contentToSave, store.mode);
            store.setCurrentLetterId(savedLetter.id);
            store.setCurrentLetterStatus(savedLetter.status);
            window.dispatchEvent(new Event('guest-history-updated'));
          }

          if (!user && !isDemoModeRef.current) {
            increment();
          }

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
        store.setGenerationError(friendly.message);
        store.setGenerationErrorKind(friendly.kind);
        return false;
      }
    },
    [user, store, ui, increment, refetchGuestUsage, runAnalysis],
  );

  const ensureAnalysisThenGenerateV2 = useCallback(
    async (inputFormData: LetterFormData, outputFormat: 'letter' | 'email') => {
      store.setIsGenerating(true);
      store.setIsGeneratingV2(true);
      store.setGenerationError(null);
      store.setGenerationErrorKind(null);

      try {
        const targetUrl = resolveTargetUrl(inputFormData);
        store.setResolvedTargetUrl(targetUrl);

        if (process.env.NODE_ENV === 'development') {
          devLog.log('[V2 Analyze] targetUrl resolution:', {
            explicitTargetUrl: inputFormData.targetUrl,
            eventUrl: inputFormData.eventUrl,
            freeformInput: inputFormData.freeformInput?.substring(0, 100),
            resolvedTargetUrl: targetUrl,
          });
        }

        let currentAnalysis = store.analysisResult;
        if (!currentAnalysis || shouldReanalyze(currentAnalysis, inputFormData, targetUrl)) {
          store.setIsAnalyzing(true);
          const result = await runAnalysis(inputFormData, targetUrl);
          store.setIsAnalyzing(false);

          if (!result) {
            store.setGenerationError('分析に失敗しました。入力内容を確認して、もう一度お試しください。');
            store.setGenerationErrorKind('unknown');
            return;
          }
          currentAnalysis = result;
          store.setAnalysisResult(result);

          if (result.sources) {
            store.setGeneratedSources(result.sources);
          }
        }

        await executeGenerateV2WithRetry(currentAnalysis, inputFormData, outputFormat, targetUrl);
      } finally {
        store.setIsGenerating(false);
        store.setIsGeneratingV2(false);
      }
    },
    [store, shouldReanalyze, runAnalysis, executeGenerateV2WithRetry],
  );

  const handleAnalyzeForV2WithFormData = useCallback(
    async (inputFormData: LetterFormData) => {
      store.setIsAnalyzing(true);
      store.setAnalysisResult(null);
      store.setGenerationError(null);
      store.setGenerationErrorKind(null);

      try {
        const targetUrl = resolveTargetUrl(inputFormData);
        store.setResolvedTargetUrl(targetUrl);

        if (process.env.NODE_ENV === 'development') {
          devLog.log('[V2 Analyze] targetUrl resolution:', {
            explicitTargetUrl: inputFormData.targetUrl,
            eventUrl: inputFormData.eventUrl,
            freeformInput: inputFormData.freeformInput?.substring(0, 100),
            resolvedTargetUrl: targetUrl,
          });
        }

        const userNotes = [
          inputFormData.companyName && `企業名: ${inputFormData.companyName}`,
          inputFormData.department && `部署: ${inputFormData.department}`,
          inputFormData.name && `担当者: ${inputFormData.name}`,
          inputFormData.position && `役職: ${inputFormData.position}`,
          inputFormData.background && `背景・経緯: ${inputFormData.background}`,
          inputFormData.problem && `課題: ${inputFormData.problem}`,
          inputFormData.invitationReason && `招待理由: ${inputFormData.invitationReason}`,
          inputFormData.eventName && `イベント名: ${inputFormData.eventName}`,
          inputFormData.eventDateTime && `イベント日時: ${inputFormData.eventDateTime}`,
          inputFormData.eventSpeakers && `登壇者: ${inputFormData.eventSpeakers}`,
          inputFormData.eventUrl && `イベントURL: ${inputFormData.eventUrl}`,
          inputFormData.freeformInput && `追加情報: ${inputFormData.freeformInput}`,
        ]
          .filter(Boolean)
          .join('\n');

        const response = await fetch('/api/analyze-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_url: targetUrl || undefined,
            user_notes: userNotes || undefined,
            sender_info: inputFormData.myCompanyName
              ? {
                  company_name: inputFormData.myCompanyName,
                  service_description: inputFormData.myServiceDescription || '',
                }
              : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `分析に失敗しました (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          store.setAnalysisResult(data.data);
          ui.setShowAnalysisModal(true);

          if (data.data.sources) {
            store.setGeneratedSources(data.data.sources);
          }
        } else {
          throw new Error(data.error || '分析結果の取得に失敗しました');
        }
      } catch (error) {
        const errorDetails = getErrorDetails(error);
        devLog.error('分析エラー:', errorDetails);
        const friendly = getUserFriendlyError(error, 'analysis');
        store.setGenerationError(friendly.message);
        store.setGenerationErrorKind(friendly.kind);
      } finally {
        store.setIsAnalyzing(false);
      }
    },
    [store, ui],
  );

  const handleQuickDraft = useCallback(async () => {
    const { formData } = store;
    const errors: Record<string, string> = {};
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      errors.companyName = '相手企業名またはURLを入力してください';
    }
    if (!formData.myServiceDescription) {
      errors.myServiceDescription = '自社サービス概要を入力してください';
    }
    if (Object.keys(errors).length > 0) {
      store.setFormErrors(errors);
      return;
    }
    store.setFormErrors({});

    if (usage?.isLimitReached && !user) {
      ui.setShowLimitModal(true);
      return;
    }

    store.setIsQuickDrafting(true);
    try {
      await ensureAnalysisThenGenerateV2(formData, 'letter');
    } finally {
      store.setIsQuickDrafting(false);
    }
  }, [store, ui, usage, user, ensureAnalysisThenGenerateV2]);

  const handleAnalyzeAndGenerate = useCallback(async () => {
    const { formData } = store;
    const errors: Record<string, string> = {};
    if (!formData.companyName && !formData.targetUrl?.trim()) {
      errors.companyName = '相手企業名またはURLを入力してください';
    }
    if (!formData.myServiceDescription) {
      errors.myServiceDescription = '自社サービス概要を入力してください';
    }
    if (Object.keys(errors).length > 0) {
      store.setFormErrors(errors);
      return;
    }
    store.setFormErrors({});

    if (usage?.isLimitReached && !user) {
      ui.setShowLimitModal(true);
      return;
    }

    await handleAnalyzeForV2WithFormData(formData);
  }, [store, ui, usage, user, handleAnalyzeForV2WithFormData]);

  const handleGenerateV2 = useCallback(
    async (overrides: UserOverrides, generateMode: 'draft' | 'complete' | 'event') => {
      const { analysisResult, formData, mode } = store;
      if (!analysisResult) return;

      store.setIsGeneratingV2(true);
      store.setIsGenerating(true);
      store.setModalError(null);

      let finalOverrides: UserOverrides;
      if (generateMode === 'event') {
        finalOverrides = {
          ...overrides,
          event_name: formData.eventName || overrides.event_name,
          event_datetime: formData.eventDateTime || overrides.event_datetime,
          event_speakers: formData.eventSpeakers || overrides.event_speakers,
        };
      } else {
        finalOverrides = overrides;
      }

      finalOverrides = {
        ...finalOverrides,
        cxo_insight: formData.cxoInsight || finalOverrides.cxo_insight || undefined,
        mutual_connection: formData.mutualConnection || finalOverrides.mutual_connection || undefined,
      };

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
            ...(isDemoModeRef.current ? { is_sample: true } : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            ui.setShowLimitModal(true);
            refetchGuestUsage();
            return;
          }
          throw new Error(errorData.error || `生成に失敗しました (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          store.resetGeneration();

          store.setGeneratedLetter(normalizeLetterText(data.data.body));

          if (data.data.variations) {
            store.setVariations({
              standard: normalizeLetterText(data.data.variations.standard),
              emotional: normalizeLetterText(data.data.variations.emotional),
              consultative: normalizeLetterText(data.data.variations.consultative),
            });
            store.setActiveVariation('standard');
          }

          const contentToSave = data.data.body;
          if (user) {
            const savedLetter = await saveToHistory(formData, contentToSave, mode, {
              sources: data.data.sources,
              citations: data.data.citations,
            });
            if (savedLetter) {
              store.setCurrentLetterId(savedLetter.id);
              store.setCurrentLetterStatus(savedLetter.status);
            }
          } else {
            const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
            const savedLetter = saveToGuestHistory(formData, contentToSave, mode);
            store.setCurrentLetterId(savedLetter.id);
            store.setCurrentLetterStatus(savedLetter.status);
            window.dispatchEvent(new Event('guest-history-updated'));
          }

          if (!user && !isDemoModeRef.current) {
            increment();
          }

          ui.setShowAnalysisModal(false);

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
        store.setModalError(friendly.message);
      } finally {
        store.setIsGeneratingV2(false);
        store.setIsGenerating(false);
      }
    },
    [store, ui, user, increment, refetchGuestUsage],
  );

  const handleSaveOnly = useCallback(async () => {
    const { formData, generatedLetter, mode, generatedSources, generatedCitations } = store;
    if (user) {
      const savedLetter = await saveToHistory(formData, generatedLetter, mode, {
        sources: generatedSources,
        citations: generatedCitations,
      });
      if (savedLetter) {
        store.setCurrentLetterId(savedLetter.id);
        store.setCurrentLetterStatus(savedLetter.status);
        toast({ title: '履歴に保存しました', type: 'success' });
      }
    } else {
      const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
      const savedLetter = saveToGuestHistory(formData, generatedLetter, mode);
      store.setCurrentLetterId(savedLetter.id);
      store.setCurrentLetterStatus(savedLetter.status);
      window.dispatchEvent(new Event('guest-history-updated'));
      toast({ title: 'ブラウザに一時保存しました', type: 'success' });
    }
  }, [store, user]);

  const handleResetOnly = useCallback(() => {
    if (store.generatedLetter) {
      if (!confirm('保存されていませんが、リセットしますか？')) {
        return;
      }
    }
    store.resetForm();
  }, [store]);

  const handleExitDemo = useCallback(() => {
    syncDemoRef(false);
    router.replace('/new');
    store.resetForm();
  }, [store, router, syncDemoRef]);

  const handleSampleExperience = useCallback(async () => {
    if (store.isSampleCooldown) return;

    store.setIsSampleCooldown(true);
    syncDemoRef(true);

    const { mode } = store;

    if (mode === 'event') {
      const { getRandomSampleCompany } = await import('@/lib/sampleData');
      const randomCompany = getRandomSampleCompany();
      const eventSample = SAMPLE_EVENT_DATA;

      const sampleFormData: LetterFormData = {
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
      store.setFormData(sampleFormData);

      try {
        await handleAnalyzeForV2WithFormData(sampleFormData);
      } finally {
        setTimeout(() => store.setIsSampleCooldown(false), 2000);
      }
      return;
    }

    // Sales mode: 3-level fallback strategy
    const { sample } = getRandomPrecomputedSample();

    const sampleFormData: LetterFormData = {
      myCompanyName: SAMPLE_DATA.myCompanyName,
      myName: SAMPLE_DATA.myName,
      myServiceDescription: SAMPLE_DATA.myServiceDescription,
      companyName: sample.companyName,
      department: SAMPLE_DATA.department,
      position: SAMPLE_DATA.position,
      name: SAMPLE_DATA.name,
      targetUrl: sample.targetUrl,
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

    store.setFormData(sampleFormData);
    store.setGenerationError(null);
    store.setGenerationErrorKind(null);

    // Level 1: Precomputed (fastest, 100% success)
    if (sample?.letters?.standard?.body) {
      try {
        store.setIsGenerating(true);
        store.setIsAnalyzing(true);
        await new Promise((r) => setTimeout(r, 1500));
        store.setIsAnalyzing(false);

        store.setAnalysisResult(sample.analysisResult);
        store.setGeneratedSources(sample.sources);

        await new Promise((r) => setTimeout(r, 1500));

        store.setGeneratedLetter(normalizeLetterText(sample.letters.standard.body));
        store.setVariations({
          standard: normalizeLetterText(sample.letters.standard.body),
          emotional: normalizeLetterText(sample.letters.emotional.body),
          consultative: normalizeLetterText(sample.letters.consultative.body),
        });
        store.setActiveVariation('standard');
        store.setEmailData(undefined);
        store.setSelfCheck(undefined);

        if (!user) {
          const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
          const savedLetter = saveToGuestHistory(sampleFormData, sample.letters.standard.body, mode);
          store.setCurrentLetterId(savedLetter.id);
          store.setCurrentLetterStatus(savedLetter.status);
          window.dispatchEvent(new Event('guest-history-updated'));
        }
      } finally {
        store.setIsGenerating(false);
        setTimeout(() => store.setIsSampleCooldown(false), 2000);
      }
      return;
    }

    // Level 2+3: API fallback
    devLog.warn('[Sample] Precomputed data not available, falling back to API');
    try {
      store.setIsGenerating(true);
      store.setIsAnalyzing(true);

      const targetUrl = resolveTargetUrl(sampleFormData);
      const analysis = await runAnalysis(sampleFormData, targetUrl);
      store.setIsAnalyzing(false);

      if (analysis) {
        store.setAnalysisResult(analysis);
        if (analysis.sources) store.setGeneratedSources(analysis.sources);

        const success = await executeGenerateV2WithRetry(analysis, sampleFormData, 'letter', targetUrl);
        if (success) return;
      }

      // Level 4: Draft mode fallback
      devLog.warn('[Sample] API fallback failed, using draft mode');
      store.setGenerationError(null);
      store.setGenerationErrorKind(null);

      const draftBody = generateDraftLetter(
        sample.companyName,
        SAMPLE_DATA.myCompanyName,
        SAMPLE_DATA.myName,
        SAMPLE_DATA.myServiceDescription,
      );
      store.setGeneratedLetter(normalizeLetterText(draftBody));
      store.setVariations(undefined);
      store.setActiveVariation('standard');
      store.setEmailData(undefined);
      store.setSelfCheck(undefined);

      if (!user) {
        const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
        const savedLetter = saveToGuestHistory(sampleFormData, draftBody, mode);
        store.setCurrentLetterId(savedLetter.id);
        store.setCurrentLetterStatus(savedLetter.status);
        window.dispatchEvent(new Event('guest-history-updated'));
      }

      toast({
        title: '下書きモードで生成しました',
        description: 'API接続に問題が発生したため、テンプレートで下書きを生成しました。',
      });
    } finally {
      store.setIsGenerating(false);
      setTimeout(() => store.setIsSampleCooldown(false), 2000);
    }
  }, [store, user, syncDemoRef, handleAnalyzeForV2WithFormData, runAnalysis, executeGenerateV2WithRetry]);

  return {
    user,
    usage,
    isDemoModeRef,
    syncDemoRef,
    ensureAnalysisThenGenerateV2,
    handleAnalyzeForV2WithFormData,
    handleQuickDraft,
    handleAnalyzeAndGenerate,
    handleGenerateV2,
    handleSaveOnly,
    handleResetOnly,
    handleExitDemo,
    handleSampleExperience,
    runAnalysis,
  };
}
