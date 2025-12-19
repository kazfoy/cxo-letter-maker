'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SALES_PLACEHOLDERS, EVENT_PLACEHOLDERS } from '@/lib/placeholders';

// PDF.jsを使用するため、SSRを無効化して動的インポート
const MultiSourceModal = dynamic(
  () => import('./MultiSourceModal').then(mod => ({ default: mod.MultiSourceModal })),
  { ssr: false }
);

// StructureSuggestionModalのインポート
const StructureSuggestionModal = dynamic(
  () => import('./StructureSuggestionModal').then(mod => ({ default: mod.StructureSuggestionModal })),
  { ssr: false }
);

interface AISuggestion {
  suggestions: string[];
}

interface ApiErrorDisplay {
  message: string;
  suggestion?: string;
  show: boolean;
}

interface LetterFormData {
  myCompanyName: string;
  myName: string;
  myServiceDescription: string;
  companyName: string;
  position: string;
  name: string;
  background: string;
  problem: string;
  solution: string;
  caseStudy: string;
  offer: string;
  freeformInput?: string;
  // イベント招待モード用フィールド
  eventUrl?: string;
  eventName?: string;
  eventDateTime?: string;
  eventSpeakers?: string;
  invitationReason?: string;
  // かんたんモード用フィールド
  simpleRequirement?: string; // 伝えたい要件
}

type LetterMode = 'sales' | 'event';

interface InputFormProps {
  mode: LetterMode;
  onGenerate: (letter: string, formData: LetterFormData) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
}

export function InputForm({ mode, onGenerate, setIsGenerating, formData, setFormData }: InputFormProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [multiSourceModalOpen, setMultiSourceModalOpen] = useState(false);
  const [sourceInputType, setSourceInputType] = useState<'own' | 'target'>('own');
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  // モードに応じた初期値: セールス=freeform, イベント=step
  const [inputMode, setInputMode] = useState<'step' | 'freeform'>(mode === 'sales' ? 'freeform' : 'step');
  const [structureSuggestionModalOpen, setStructureSuggestionModalOpen] = useState(false);
  // セールスモードのみ使用（イベントモードではfreeform/stepで制御）
  const [inputComplexity, setInputComplexity] = useState<'simple' | 'detailed'>(mode === 'sales' ? 'simple' : 'detailed');
  const [errorDisplay, setErrorDisplay] = useState<ApiErrorDisplay>({ message: '', show: false });

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // エラーを表示するヘルパー関数
  const showError = (message: string, suggestion?: string) => {
    setErrorDisplay({ message, suggestion, show: true });
    // 5秒後に自動で消す
    setTimeout(() => {
      setErrorDisplay((prev: ApiErrorDisplay) => ({ ...prev, show: false }));
    }, 8000);
  };

  // APIエラーレスポンスを処理するヘルパー関数
  const handleApiErrorData = (errorData: any) => {
    if (errorData.error) {
      // 構造化エラーレスポンス
      showError(errorData.message || 'エラーが発生しました', errorData.suggestion);
    } else if (errorData.error || typeof errorData === 'string') {
      showError(errorData.error || errorData || 'エラーが発生しました');
    } else {
      showError('エラーが発生しました');
    }
  };

  const handleAIAssist = async (field: string) => {
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
          // イベントモードの場合、追加情報を送信
          ...(mode === 'event' && {
            eventName: formData.eventName,
            eventDateTime: formData.eventDateTime,
            eventSpeakers: formData.eventSpeakers,
          }),
        }),
      });

      const data: AISuggestion = await response.json();
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
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setFormData((prev) => ({ ...prev, [currentField]: suggestion }));
    setAiModalOpen(false);
    setAiSuggestions([]);
  };

  const handleOpenMultiSourceModal = (type: 'own' | 'target') => {
    setSourceInputType(type);
    setMultiSourceModalOpen(true);
  };

  const handleAnalyzeMultiSource = async (urls: string[], pdfText: string | null) => {
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
        // 自社情報を埋める
        setFormData((prev) => ({
          ...prev,
          myCompanyName: companyName || prev.myCompanyName,
          myServiceDescription: summary || prev.myServiceDescription,
        }));
      } else {
        // ターゲット情報を埋める
        if (mode === 'event') {
          // イベントモードの場合
          setFormData((prev) => ({
            ...prev,
            companyName: companyName || prev.companyName,
            name: personName || prev.name,
            position: personPosition || prev.position,
            // 招待の背景（Why You?）にcontextを反映（既存の内容がある場合は追記）
            invitationReason: context
              ? prev.invitationReason
                ? `${prev.invitationReason}\n\n${context}`
                : context
              : prev.invitationReason,
          }));
        } else {
          // セールスモードの場合
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
  };

  const handleOpenStructureSuggestion = () => {
    if (!formData.companyName || !formData.myServiceDescription) {
      showError('構成案を提案するには、企業名と自社サービスの概要を入力してください。');
      return;
    }
    setStructureSuggestionModalOpen(true);
  };

  const handleSelectApproach = (draftText: string) => {
    setFormData((prev) => ({ ...prev, freeformInput: draftText }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, model: 'flash', mode, inputComplexity }),
      });

      const data = await response.json();
      if (data.letter) {
        onGenerate(data.letter, formData);
      } else if (data.error) {
        handleApiErrorData(data);
      }
    } catch (error) {
      console.error('生成エラー:', error);
      showError('手紙の生成に失敗しました。', 'もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  // イベントURL解析ハンドラー
  const handleAnalyzeEventUrl = async () => {
    if (!formData.eventUrl) {
      showError('イベントURLを入力してください。');
      return;
    }

    setIsAnalyzingSource(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('urls', JSON.stringify([formData.eventUrl]));
      formDataToSend.append('isEventUrl', 'true'); // イベントURL解析フラグ

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

      // 成功メッセージは不要（フォームが更新されるため）
    } catch (error) {
      console.error('イベントURL解析エラー:', error);
      showError('イベントURL解析に失敗しました。', 'URLを確認して、もう一度お試しください。');
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        {mode === 'sales' ? '手紙の情報を入力' : 'イベント招待状の情報を入力'}
      </h2>

      {/* エラー表示 */}
      {errorDisplay.show && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md animate-fade-in">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {errorDisplay.message}
              </h3>
              {errorDisplay.suggestion && (
                <p className="mt-1 text-sm text-red-700">
                  💡 {errorDisplay.suggestion}
                </p>
              )}
            </div>
            <button
              onClick={() => setErrorDisplay({ message: '', show: false })}
              className="ml-4 flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label="閉じる"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 入力複雑度切り替えタブ（セールスモードのみ） */}
      {mode === 'sales' && (
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => setInputComplexity('simple')}
            className={`px-6 py-2.5 font-medium text-sm transition-colors ${
              inputComplexity === 'simple'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚡ かんたんモード
          </button>
          <button
            type="button"
            onClick={() => setInputComplexity('detailed')}
            className={`px-6 py-2.5 font-medium text-sm transition-colors ${
              inputComplexity === 'detailed'
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📝 詳細モード
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* かんたんモードのフォーム */}
        {mode === 'sales' && inputComplexity === 'simple' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <p className="text-sm text-blue-800">
                💡 最小限の情報でお試しいただけます。AIが自動的に補完して手紙を作成します。
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. ターゲット企業名 */}
              <div>
                <label htmlFor="simpleCompanyName" className="block text-sm font-medium text-gray-700 mb-1">
                  1. ターゲット企業名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="simpleCompanyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={SALES_PLACEHOLDERS.companyName}
                />
              </div>

              {/* 2. 自社サービス名・概要 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="simpleServiceDescription" className="block text-sm font-medium text-gray-700">
                    2. 自社サービス名・概要 <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenMultiSourceModal('own')}
                    className="bg-green-50 text-green-700 border border-green-300 px-3 py-1 rounded-md hover:bg-green-100 transition-colors text-xs font-medium"
                    aria-label="自社HPから入力"
                  >
                    🏢 HPから入力
                  </button>
                </div>
                <textarea
                  id="simpleServiceDescription"
                  name="myServiceDescription"
                  value={formData.myServiceDescription}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={SALES_PLACEHOLDERS.myServiceDescription}
                  maxLength={300}
                />
              </div>

              {/* 3. 伝えたい要件 */}
              <div>
                <label htmlFor="simpleRequirement" className="block text-sm font-medium text-gray-700 mb-1">
                  3. 伝えたい要件（任意）
                </label>
                <input
                  type="text"
                  id="simpleRequirement"
                  name="simpleRequirement"
                  value={formData.simpleRequirement || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={SALES_PLACEHOLDERS.simpleRequirement}
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-gray-500">
                  手紙の目的を一言で記入してください（例: 「アポを取りたい」「サービス紹介」）
                </p>
              </div>
            </div>
          </>
        )}

        {/* 詳細モードまたはイベントモードのフォーム */}
        {(mode === 'event' || inputComplexity === 'detailed') && (
          <>
        {/* 自社情報 */}
        <div className="border-b pb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-700">差出人（自社）情報</h3>
            <button
              type="button"
              onClick={() => handleOpenMultiSourceModal('own')}
              className="bg-green-50 text-green-700 border border-green-300 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
              aria-label="自社HPから入力"
            >
              🏢 自社HP/資料から入力
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="myCompanyName" className="block text-sm font-medium text-gray-700 mb-1">
                会社名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="myCompanyName"
                name="myCompanyName"
                value={formData.myCompanyName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.myCompanyName : EVENT_PLACEHOLDERS.myCompanyName}
              />
            </div>
            <div>
              <label htmlFor="myName" className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="myName"
                name="myName"
                value={formData.myName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.myName : EVENT_PLACEHOLDERS.myName}
              />
            </div>
            <div>
              <label htmlFor="myServiceDescription" className="block text-sm font-medium text-gray-700 mb-1">
                自社サービスの概要 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="myServiceDescription"
                name="myServiceDescription"
                value={formData.myServiceDescription}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.myServiceDescription : EVENT_PLACEHOLDERS.myServiceDescription}
                maxLength={500}
              />
            </div>
          </div>
        </div>

        {/* ターゲット情報 */}
        <div className="border-b pb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-700">ターゲット情報</h3>
            <button
              type="button"
              onClick={() => handleOpenMultiSourceModal('target')}
              className="bg-purple-50 text-purple-700 border border-purple-300 px-3 py-1.5 rounded-md hover:bg-purple-100 transition-colors text-sm font-medium"
              aria-label="相手の記事/HPから入力"
            >
              🔍 相手HP/記事から入力
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                企業名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.companyName : EVENT_PLACEHOLDERS.companyName}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                  役職
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.position : EVENT_PLACEHOLDERS.position}
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={mode === 'sales' ? SALES_PLACEHOLDERS.name : EVENT_PLACEHOLDERS.name}
                />
              </div>
            </div>
          </div>
        </div>

        {/* イベント情報セクション（イベントモードのみ） */}
        {mode === 'event' && (
          <div className="border-b pb-4">
            <h3 className="font-medium text-gray-700 mb-3">イベント情報</h3>

            {/* タブUI */}
            <div className="flex gap-2 border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setInputMode('step')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  inputMode === 'step'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ステップ入力（詳細）
              </button>
              <button
                type="button"
                onClick={() => setInputMode('freeform')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  inputMode === 'freeform'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                まとめて入力
              </button>
            </div>

            {/* ステップ入力モード */}
            {inputMode === 'step' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="eventUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  イベントURL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    id="eventUrl"
                    name="eventUrl"
                    value={formData.eventUrl || ''}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={EVENT_PLACEHOLDERS.eventUrl}
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeEventUrl}
                    disabled={!formData.eventUrl || isAnalyzingSource}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                  >
                    {isAnalyzingSource ? '解析中...' : '自動解析'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 mb-1">
                  イベント名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="eventName"
                  name="eventName"
                  value={formData.eventName || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={EVENT_PLACEHOLDERS.eventName}
                />
              </div>

              <div>
                <label htmlFor="eventDateTime" className="block text-sm font-medium text-gray-700 mb-1">
                  開催日時・場所 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="eventDateTime"
                  name="eventDateTime"
                  value={formData.eventDateTime || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={EVENT_PLACEHOLDERS.eventDateTime}
                />
              </div>

              <div>
                <label htmlFor="eventSpeakers" className="block text-sm font-medium text-gray-700 mb-1">
                  主要登壇者/ゲスト
                </label>
                <textarea
                  id="eventSpeakers"
                  name="eventSpeakers"
                  value={formData.eventSpeakers || ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={EVENT_PLACEHOLDERS.eventSpeakers}
                  maxLength={300}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="invitationReason" className="block text-sm font-medium text-gray-700">
                    招待の背景（Why You?） <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAIAssist('invitationReason')}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    aria-label="AIアシスト"
                  >
                    🪄 AIアシスト
                  </button>
                </div>
                <textarea
                  id="invitationReason"
                  name="invitationReason"
                  value={formData.invitationReason || ''}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={EVENT_PLACEHOLDERS.invitationReason}
                  maxLength={500}
                />
              </div>
            </div>
            )}

            {/* まとめて入力モード */}
            {inputMode === 'freeform' && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4 mb-4">
                  <p className="text-sm text-purple-800">
                    💡 最小限の情報でイベント招待状を作成できます。AIがイベント情報を解析し、招待の必然性を構成します。
                  </p>
                </div>

                {/* 1. イベントURL */}
                <div>
                  <label htmlFor="eventUrlFreeform" className="block text-sm font-medium text-gray-700 mb-1">
                    1. イベントURL <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      id="eventUrlFreeform"
                      name="eventUrl"
                      value={formData.eventUrl || ''}
                      onChange={handleChange}
                      required={inputMode === 'freeform'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={EVENT_PLACEHOLDERS.eventUrlFreeform}
                    />
                    <button
                      type="button"
                      onClick={handleAnalyzeEventUrl}
                      disabled={!formData.eventUrl || isAnalyzingSource}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                    >
                      {isAnalyzingSource ? '解析中...' : '自動解析'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    イベントのURLを入力して「自動解析」をクリックすると、イベント名・日時・登壇者が自動入力されます
                  </p>
                </div>

                {/* 2. ターゲット企業名 */}
                <div>
                  <label htmlFor="companyNameFreeform" className="block text-sm font-medium text-gray-700 mb-1">
                    2. ターゲット企業名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="companyNameFreeform"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    required={inputMode === 'freeform'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={EVENT_PLACEHOLDERS.companyNameFreeform}
                  />
                </div>

                {/* 3. 誘いたい理由・メモ */}
                <div>
                  <label htmlFor="invitationMemo" className="block text-sm font-medium text-gray-700 mb-1">
                    3. 誘いたい理由・メモ（任意）
                  </label>
                  <textarea
                    id="invitationMemo"
                    name="invitationReason"
                    value={formData.invitationReason || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={EVENT_PLACEHOLDERS.invitationMemo}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    招待したい背景や理由を自由に記入してください。AIが招待状の「Why You?」部分を構成します。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CxOレター構成 5要素（セールスモードのみ） */}
        {mode === 'sales' && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-700 mb-3">CxOレター構成（5要素）</h3>

          {/* タブUI */}
          <div className="flex gap-2 border-b border-gray-200 mb-4">
            <button
              type="button"
              onClick={() => setInputMode('step')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                inputMode === 'step'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ステップ入力
            </button>
            <button
              type="button"
              onClick={() => setInputMode('freeform')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                inputMode === 'freeform'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              まとめて入力
            </button>
          </div>

          {/* ステップ入力モード */}
          {inputMode === 'step' && (
          <>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="background" className="block text-sm font-medium text-gray-700">
                1. 背景・フック <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAIAssist('background')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                aria-label="AIアシスト"
              >
                🪄 AIアシスト
              </button>
            </div>
            <textarea
              id="background"
              name="background"
              value={formData.background}
              onChange={handleChange}
              required={inputMode === 'step'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={SALES_PLACEHOLDERS.background}
              maxLength={500}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="problem" className="block text-sm font-medium text-gray-700">
                2. 課題の指摘 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAIAssist('problem')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                aria-label="AIアシスト"
              >
                🪄 AIアシスト
              </button>
            </div>
            <textarea
              id="problem"
              name="problem"
              value={formData.problem}
              onChange={handleChange}
              required={inputMode === 'step'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={SALES_PLACEHOLDERS.problem}
              maxLength={500}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="solution" className="block text-sm font-medium text-gray-700">
                3. 解決策の提示 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAIAssist('solution')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                aria-label="AIアシスト"
              >
                🪄 AIアシスト
              </button>
            </div>
            <textarea
              id="solution"
              name="solution"
              value={formData.solution}
              onChange={handleChange}
              required={inputMode === 'step'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={SALES_PLACEHOLDERS.solution}
              maxLength={500}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="caseStudy" className="block text-sm font-medium text-gray-700">
                4. 事例・実績 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAIAssist('caseStudy')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                aria-label="AIアシスト"
              >
                🪄 AIアシスト
              </button>
            </div>
            <textarea
              id="caseStudy"
              name="caseStudy"
              value={formData.caseStudy}
              onChange={handleChange}
              required={inputMode === 'step'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={SALES_PLACEHOLDERS.caseStudy}
              maxLength={500}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="offer" className="block text-sm font-medium text-gray-700">
                5. オファー <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleAIAssist('offer')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                aria-label="AIアシスト"
              >
                🪄 AIアシスト
              </button>
            </div>
            <textarea
              id="offer"
              name="offer"
              value={formData.offer}
              onChange={handleChange}
              required={inputMode === 'step'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={SALES_PLACEHOLDERS.offer}
              maxLength={500}
            />
          </div>
          </>
          )}

          {/* まとめて入力モード */}
          {inputMode === 'freeform' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="freeformInput" className="block text-sm font-medium text-gray-700">
                  手紙の内容をまとめて入力 <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleOpenStructureSuggestion}
                  className="text-sm bg-purple-50 text-purple-700 border border-purple-300 px-4 py-1.5 rounded-md hover:bg-purple-100 transition-colors font-medium flex items-center gap-1"
                  aria-label="構成案を相談する"
                >
                  💡 構成案を相談する
                </button>
              </div>
              <textarea
                id="freeformInput"
                name="freeformInput"
                value={formData.freeformInput || ''}
                onChange={handleChange}
                required={inputMode === 'freeform'}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={SALES_PLACEHOLDERS.freeformInput}
              />
              <p className="mt-2 text-xs text-gray-500">
                💡 箇条書き、メモ、既存の文章など、どんな形式でもOKです。AIが自動的にCxOレターの形式に整形します。
              </p>
            </div>
          )}
        </div>
        )}
        </>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="手紙を生成"
        >
          {mode === 'sales' ? '手紙を生成' : 'イベント招待状を生成'}
        </button>
      </form>

      {/* AIアシストモーダル */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">AIアシスト - 候補を選択</h3>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {isLoadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">AIが候補を考えています...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-800">候補 {index + 1}</h4>
                        <button
                          className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                          aria-label="この候補を選択"
                        >
                          選択
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{suggestion}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* マルチソース入力モーダル */}
      <MultiSourceModal
        isOpen={multiSourceModalOpen}
        onClose={() => setMultiSourceModalOpen(false)}
        onAnalyze={handleAnalyzeMultiSource}
        type={sourceInputType}
        isAnalyzing={isAnalyzingSource}
      />

      {/* 構成案提案モーダル */}
      <StructureSuggestionModal
        isOpen={structureSuggestionModalOpen}
        onClose={() => setStructureSuggestionModalOpen(false)}
        onSelectApproach={handleSelectApproach}
        companyName={formData.companyName}
        myServiceDescription={formData.myServiceDescription}
        background={formData.background}
      />
    </div>
  );
}
