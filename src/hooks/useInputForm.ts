import { useState, useEffect, useCallback } from 'react';
import { getErrorDetails } from '@/lib/errorUtils';

import { useToast } from '@/hooks/use-toast';
import type { LetterFormData, LetterMode, ApiErrorResponse, AnalysisPhase, SSEEvent } from '@/types/letter';
import { devLog } from '@/lib/logger';

interface UseInputFormProps {
  mode: LetterMode;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;

  setIsGenerating: (isGenerating: boolean) => void;
  onGenerationAttempt?: () => void | Promise<void>;
  /** V2統一生成関数 */
  onGenerateV2: (formData: LetterFormData, outputFormat: 'letter' | 'email') => Promise<void>;
}

export function useInputForm({
  mode,
  formData,
  setFormData,
  setIsGenerating,
  onGenerationAttempt,
  onGenerateV2,
}: UseInputFormProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [multiSourceModalOpen, setMultiSourceModalOpen] = useState(false);
  const [sourceInputType, setSourceInputType] = useState<'own' | 'target'>('own');
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase | null>(null);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [inputMode, setInputMode] = useState<'step' | 'freeform'>(mode === 'sales' ? 'freeform' : 'step');
  const [structureSuggestionModalOpen, setStructureSuggestionModalOpen] = useState(false);
  const { toast } = useToast();

  // モード変更時にタブをリセット
  useEffect(() => {
    if (mode === 'sales') {
      setInputMode('freeform');
    } else {
      setInputMode('step');
    }
  }, [mode]);

  // エラーを表示するヘルパー関数
  const showError = useCallback((message: string, suggestion?: string) => {
    toast({
      title: "エラーが発生しました",
      description: suggestion ? `${message}\n${suggestion}` : message,
      type: "error",
      duration: 5000,
    });
  }, [toast]);

  // APIエラーレスポンスを処理するヘルパー関数
  const handleApiErrorData = useCallback((errorData: ApiErrorResponse | unknown) => {
    if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
      const err = errorData as ApiErrorResponse;
      showError(err.message || 'エラーが発生しました', err.suggestion);
    } else if (typeof errorData === 'string') {
      showError(errorData);
    } else {
      showError('エラーが発生しました');
    }
  }, [showError]);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, [setFormData]);

  const handleAIAssist = useCallback(async (field: string) => {
    if (!formData.companyName || !formData.myServiceDescription) {
      showError('AIアシストを使用するには、企業名と自社サービスの概要を入力してください。');
      return;
    }

    setCurrentField(field);
    setIsLoadingAI(true);
    setAiModalOpen(true);

    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          companyName: formData.companyName,
          myServiceDescription: formData.myServiceDescription,
          mode,
          ...(mode === 'event' && {
            eventName: formData.eventName,
            eventDateTime: formData.eventDateTime,
            eventSpeakers: formData.eventSpeakers,
          }),
        }),
      });

      const data = await response.json();
      if (data.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      devLog.error('AIアシストエラー:', error);
      showError('AIアシストに失敗しました。', 'もう一度お試しください。');
      setAiModalOpen(false);
    } finally {
      setIsLoadingAI(false);
    }
  }, [formData.companyName, formData.myServiceDescription, formData.eventName, formData.eventDateTime, formData.eventSpeakers, mode, showError]);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setFormData((prev) => ({ ...prev, [currentField]: suggestion }));
    setAiModalOpen(false);
    setAiSuggestions([]);
  }, [currentField, setFormData]);

  const handleOpenMultiSourceModal = useCallback((type: 'own' | 'target') => {
    setSourceInputType(type);
    setMultiSourceModalOpen(true);
  }, []);

  // SSEイベントをパースするヘルパー関数
  const parseSSEEvents = useCallback((text: string): SSEEvent[] => {
    const events: SSEEvent[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const jsonStr = line.slice(6);
          const event = JSON.parse(jsonStr) as SSEEvent;
          events.push(event);
        } catch {
          // JSONパース失敗は無視
        }
      }
    }
    return events;
  }, []);

  const handleAnalyzeMultiSource = useCallback(async (urls: string[], pdfText: string | null) => {
    setIsAnalyzingSource(true);
    setAnalysisPhase('connecting');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('urls', JSON.stringify(urls.filter(u => u.trim())));
      formDataToSend.append('sourceInputType', sourceInputType);
      // 既存の会社名があればフォールバック用に送信
      if (formData.companyName) {
        formDataToSend.append('companyName', formData.companyName);
      }
      if (pdfText) {
        formDataToSend.append('pdfText', pdfText);
      }
      // サンプル判定用の送信者企業名
      if (formData.myCompanyName) {
        formDataToSend.append('senderCompany', formData.myCompanyName);
      }

      // SSE対応APIを使用
      const response = await fetch('/api/analyze-source-stream', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.body) {
        throw new Error('レスポンスボディがありません');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track which fields were updated for user feedback
      const updatedFields: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // バッファから完全なイベントを抽出
        const events = parseSSEEvents(buffer);

        for (const event of events) {
          // フェーズ更新
          if (event.phase && event.phase !== 'complete') {
            setAnalysisPhase(event.phase);
          }

          // エラー処理
          if (event.error) {
            showError(event.error);
            setMultiSourceModalOpen(false);
            return;
          }

          // 完了時のデータ処理
          if (event.phase === 'complete' && event.data) {
            const { companyName, personName, personPosition, summary, context, letterStructure } = event.data;

            if (sourceInputType === 'own') {
              setFormData((prev) => ({
                ...prev,
                myCompanyName: companyName || prev.myCompanyName,
                myServiceDescription: summary || prev.myServiceDescription,
                background: letterStructure?.background || prev.background,
                problem: letterStructure?.problem || prev.problem,
                solution: letterStructure?.solution || prev.solution,
                caseStudy: letterStructure?.caseStudy || prev.caseStudy,
                offer: letterStructure?.offer || prev.offer,
              }));
              if (companyName) updatedFields.push('会社名');
              if (summary) updatedFields.push('サービス概要');
              if (letterStructure?.background) updatedFields.push('想定課題');
              if (letterStructure?.solution) updatedFields.push('自社強み');
              if (letterStructure?.caseStudy) updatedFields.push('提案アプローチ');
            } else {
              if (mode === 'event') {
                setFormData((prev) => ({
                  ...prev,
                  companyName: companyName || prev.companyName,
                  name: personName || prev.name,
                  position: personPosition || prev.position,
                  invitationReason: context
                    ? prev.invitationReason
                      ? `${prev.invitationReason}\n\n${context}`
                      : context
                    : prev.invitationReason,
                }));
                if (companyName) updatedFields.push('企業名');
                if (personName) updatedFields.push('氏名');
                if (personPosition) updatedFields.push('役職');
                if (context) updatedFields.push('招待の背景');
              } else {
                setFormData((prev) => ({
                  ...prev,
                  companyName: companyName || prev.companyName,
                  name: personName || prev.name,
                  position: personPosition || prev.position,
                  background: context || letterStructure?.background || prev.background,
                  problem: letterStructure?.problem || prev.problem,
                  solution: letterStructure?.solution || prev.solution,
                  caseStudy: letterStructure?.caseStudy || prev.caseStudy,
                  offer: letterStructure?.offer || prev.offer,
                }));
                if (companyName) updatedFields.push('企業名');
                if (personName) updatedFields.push('氏名');
                if (personPosition) updatedFields.push('役職');
                if (context || letterStructure?.background) updatedFields.push('背景・フック');
                if (letterStructure?.problem) updatedFields.push('課題');
                if (letterStructure?.solution) updatedFields.push('解決策');
                if (letterStructure?.caseStudy) updatedFields.push('提案アプローチ');
                if (letterStructure?.offer) updatedFields.push('オファー');
              }
            }

            setAnalysisPhase('complete');
            setMultiSourceModalOpen(false);

            // Show success toast with updated fields
            if (updatedFields.length > 0) {
              toast({
                title: "情報を入力しました",
                description: `${updatedFields.join('、')}を自動入力しました`,
                type: "success",
                duration: 4000,
              });
            } else {
              toast({
                title: "情報が見つかりませんでした",
                description: `URLから有効な情報を抽出できませんでした。別のページを試してください。`,
                type: "warning",
                duration: 5000,
              });
            }
          }
        }

        // 処理済みのイベントをバッファから削除
        const lastNewline = buffer.lastIndexOf('\n\n');
        if (lastNewline !== -1) {
          buffer = buffer.slice(lastNewline + 2);
        }
      }
    } catch (error) {
      devLog.error('ソース解析エラー:', error);
      showError('ソース解析に失敗しました。', 'もう一度お試しください。');
    } finally {
      setIsAnalyzingSource(false);
      setAnalysisPhase(null);
    }
  }, [sourceInputType, mode, formData.companyName, setFormData, showError, toast, parseSSEEvents]);


  const handleOpenStructureSuggestion = useCallback(() => {
    if (!formData.companyName || !formData.myServiceDescription) {
      showError('構成案を提案するには、企業名と自社サービスの概要を入力してください。');
      return;
    }
    setStructureSuggestionModalOpen(true);
  }, [formData.companyName, formData.myServiceDescription, showError]);

  const handleSelectApproach = useCallback((draftText: string) => {
    setFormData((prev) => ({ ...prev, freeformInput: draftText }));
  }, [setFormData]);

  // 生成ロジック（V2統一）
  const executeGeneration = useCallback(async (outputFormat: 'letter' | 'email') => {
    setIsGeneratingLocal(true);
    setGenerationSuccess(false);
    try {
      await onGenerateV2(formData, outputFormat);
      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 2000);
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      devLog.error('[ERROR] V2生成エラー:', errorDetails);
      showError('生成に失敗しました。', 'もう一度お試しください。');
    } finally {
      setIsGeneratingLocal(false);
    }
  }, [formData, onGenerateV2, showError]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeGeneration('letter');
  }, [executeGeneration]);

  const handleGenerateEmail = useCallback(() => {
    executeGeneration('email');
  }, [executeGeneration]);

  const handleAnalyzeEventUrl = useCallback(async () => {
    if (!formData.eventUrl) {
      showError('イベントURLを入力してください。');
      return;
    }

    setIsAnalyzingSource(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('urls', JSON.stringify([formData.eventUrl]));
      formDataToSend.append('isEventUrl', 'true');

      const response = await fetch('/api/analyze-source', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        handleApiErrorData(data);
        return;
      }

      const { eventName, eventDateTime, eventSpeakers } = data.data;

      setFormData((prev) => ({
        ...prev,
        eventName: eventName || prev.eventName,
        eventDateTime: eventDateTime || prev.eventDateTime,
        eventSpeakers: eventSpeakers || prev.eventSpeakers,
      }));
    } catch (error) {
      devLog.error('イベントURL解析エラー:', error);
      showError('イベントURL解析に失敗しました。', 'URLを確認して、もう一度お試しください。');
    } finally {
      setIsAnalyzingSource(false);
    }
  }, [formData.eventUrl, handleApiErrorData, setFormData, showError]);

  return {
    // State
    aiModalOpen,
    aiSuggestions,
    currentField,
    isLoadingAI,
    multiSourceModalOpen,
    sourceInputType,
    isAnalyzingSource,
    analysisPhase,
    isGeneratingLocal,
    generationSuccess,
    inputMode,
    structureSuggestionModalOpen,
    // State setters
    setAiModalOpen,
    setAiSuggestions,
    setMultiSourceModalOpen,
    setStructureSuggestionModalOpen,
    setInputMode,
    // Handlers
    handleChange,
    handleAIAssist,
    handleSelectSuggestion,
    handleOpenMultiSourceModal,

    handleAnalyzeMultiSource,
    handleOpenStructureSuggestion,
    handleSelectApproach,
    handleSubmit,
    handleGenerateEmail, // Exported
    handleAnalyzeEventUrl,
  };
}
