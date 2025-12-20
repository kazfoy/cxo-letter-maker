import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LetterFormData, LetterMode, InputComplexity, ApiErrorResponse } from '@/types/letter';

interface UseInputFormProps {
  mode: LetterMode;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
  onGenerate: (letter: string, formData: LetterFormData) => void | Promise<void>;
  setIsGenerating: (isGenerating: boolean) => void;
}

export function useInputForm({
  mode,
  formData,
  setFormData,
  onGenerate,
  setIsGenerating,
}: UseInputFormProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [multiSourceModalOpen, setMultiSourceModalOpen] = useState(false);
  const [sourceInputType, setSourceInputType] = useState<'own' | 'target'>('own');
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [inputMode, setInputMode] = useState<'step' | 'freeform'>(mode === 'sales' ? 'freeform' : 'step');
  const [structureSuggestionModalOpen, setStructureSuggestionModalOpen] = useState(false);
  const [inputComplexity, setInputComplexity] = useState<InputComplexity>(mode === 'sales' ? 'simple' : 'detailed');
  const { toast } = useToast();

  // モード変更時にタブをリセット
  useEffect(() => {
    if (mode === 'sales') {
      setInputMode('freeform');
      setInputComplexity('simple');
    } else {
      setInputMode('step');
      setInputComplexity('detailed');
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
  const handleApiErrorData = useCallback((errorData: ApiErrorResponse | any) => {
    if (errorData.error) {
      showError(errorData.message || 'エラーが発生しました', errorData.suggestion);
    } else if (errorData.error || typeof errorData === 'string') {
      showError(errorData.error || errorData || 'エラーが発生しました');
    } else {
      showError('エラーが発生しました');
    }
  }, [showError]);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      console.error('AIアシストエラー:', error);
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

  const handleAnalyzeMultiSource = useCallback(async (urls: string[], pdfText: string | null) => {
    setIsAnalyzingSource(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('urls', JSON.stringify(urls.filter(u => u.trim())));
      if (pdfText) {
        formDataToSend.append('pdfText', pdfText);
      }

      const response = await fetch('/api/analyze-source', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        handleApiErrorData(data);
        return;
      }

      const { companyName, personName, personPosition, summary, context } = data.data;

      if (sourceInputType === 'own') {
        setFormData((prev) => ({
          ...prev,
          myCompanyName: companyName || prev.myCompanyName,
          myServiceDescription: summary || prev.myServiceDescription,
        }));
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
        } else {
          setFormData((prev) => ({
            ...prev,
            companyName: companyName || prev.companyName,
            name: personName || prev.name,
            position: personPosition || prev.position,
            background: context || prev.background,
          }));
        }
      }

      setMultiSourceModalOpen(false);
    } catch (error) {
      console.error('ソース解析エラー:', error);
      showError('ソース解析に失敗しました。', 'もう一度お試しください。');
    } finally {
      setIsAnalyzingSource(false);
    }
  }, [sourceInputType, mode, handleApiErrorData, setFormData, showError]);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setIsGeneratingLocal(true);
    setGenerationSuccess(false);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, model: 'flash', mode, inputComplexity }),
      });

      const data = await response.json();
      if (data.letter) {
        onGenerate(data.letter, formData);
        setGenerationSuccess(true);
        setTimeout(() => setGenerationSuccess(false), 2000);
      } else if (data.error) {
        handleApiErrorData(data);
      }
    } catch (error) {
      console.error('生成エラー:', error);
      showError('手紙の生成に失敗しました。', 'もう一度お試しください。');
    } finally {
      setIsGenerating(false);
      setIsGeneratingLocal(false);
    }
  }, [formData, mode, inputComplexity, onGenerate, setIsGenerating, handleApiErrorData, showError]);

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
      console.error('イベントURL解析エラー:', error);
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
    isGeneratingLocal,
    generationSuccess,
    inputMode,
    structureSuggestionModalOpen,
    inputComplexity,
    // State setters
    setAiModalOpen,
    setAiSuggestions,
    setMultiSourceModalOpen,
    setStructureSuggestionModalOpen,
    setInputMode,
    setInputComplexity,
    // Handlers
    handleChange,
    handleAIAssist,
    handleSelectSuggestion,
    handleOpenMultiSourceModal,
    handleAnalyzeMultiSource,
    handleOpenStructureSuggestion,
    handleSelectApproach,
    handleSubmit,
    handleAnalyzeEventUrl,
  };
}
