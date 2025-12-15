'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

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
}

interface InputFormProps {
  onGenerate: (letter: string, formData: LetterFormData) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
}

export function InputForm({ onGenerate, setIsGenerating, formData, setFormData }: InputFormProps) {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [multiSourceModalOpen, setMultiSourceModalOpen] = useState(false);
  const [sourceInputType, setSourceInputType] = useState<'own' | 'target'>('own');
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [inputMode, setInputMode] = useState<'step' | 'freeform'>('step'); // タブ切り替え用
  const [structureSuggestionModalOpen, setStructureSuggestionModalOpen] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAIAssist = async (field: string) => {
    if (!formData.companyName || !formData.myServiceDescription) {
      alert('AIアシストを使用するには、企業名と自社サービスの概要を入力してください。');
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
        }),
      });

      const data: AISuggestion = await response.json();
      if (data.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('AIアシストエラー:', error);
      alert('AIアシストに失敗しました。');
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
        alert(data.error || 'ソース解析に失敗しました。');
        return;
      }

      const { companyName, personName, summary, context } = data.data;

      if (sourceInputType === 'own') {
        // 自社情報を埋める
        setFormData((prev) => ({
          ...prev,
          myCompanyName: companyName || prev.myCompanyName,
          myServiceDescription: summary || prev.myServiceDescription,
        }));
      } else {
        // ターゲット情報を埋める
        setFormData((prev) => ({
          ...prev,
          companyName: companyName || prev.companyName,
          name: personName || prev.name,
          background: context || prev.background,
        }));
      }

      setMultiSourceModalOpen(false);
    } catch (error) {
      console.error('ソース解析エラー:', error);
      alert('ソース解析に失敗しました。もう一度お試しください。');
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  const handleOpenStructureSuggestion = () => {
    if (!formData.companyName || !formData.myServiceDescription) {
      alert('構成案を提案するには、企業名と自社サービスの概要を入力してください。');
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
        body: JSON.stringify({ ...formData, model: 'flash' }),
      });

      const data = await response.json();
      if (data.letter) {
        onGenerate(data.letter, formData);
      }
    } catch (error) {
      console.error('生成エラー:', error);
      alert('手紙の生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        手紙の情報を入力
      </h2>

      {/* URL自動入力ボタン */}
      <div className="mb-4 flex gap-3">
        <button
          type="button"
          onClick={() => handleOpenMultiSourceModal('own')}
          className="flex-1 bg-green-50 text-green-700 border border-green-300 py-2 px-4 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
          aria-label="自社HPから入力"
        >
          🏢 自社HPから入力
        </button>
        <button
          type="button"
          onClick={() => handleOpenMultiSourceModal('target')}
          className="flex-1 bg-purple-50 text-purple-700 border border-purple-300 py-2 px-4 rounded-md hover:bg-purple-100 transition-colors text-sm font-medium"
          aria-label="相手の記事/HPから入力"
        >
          🔍 相手の記事/HPから入力
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 自社情報 */}
        <div className="border-b pb-4">
          <h3 className="font-medium text-gray-700 mb-3">差出人（自社）情報</h3>
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
                placeholder="例: 株式会社△△"
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
                placeholder="例: 佐藤 花子"
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
                placeholder="自社が提供するサービス・ソリューションの概要を記載してください"
                maxLength={500}
              />
            </div>
          </div>
        </div>

        {/* ターゲット情報 */}
        <div className="border-b pb-4">
          <h3 className="font-medium text-gray-700 mb-3">ターゲット情報</h3>
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
                placeholder="例: 株式会社〇〇"
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
                  placeholder="例: 代表取締役"
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
                  placeholder="例: 山田 太郎"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CxOレター構成 5要素 */}
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
              placeholder="なぜ今、貴社（あなた）なのか。ニュースや決算情報から言及。"
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
              placeholder="業界特有の課題や、成長企業が陥る壁への共感。"
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
              placeholder="自社ソリューションによる解決アプローチ（売り込みすぎない）。"
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
              placeholder="同業他社や類似ステージ企業での実績。"
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
              placeholder="具体的なアクション（「情報交換の時間をください」など）。"
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
                placeholder="ここにメモや箇条書き、あるいは既存のドラフトを貼り付けてください。AIが要素を抽出して構成します。&#10;&#10;例：&#10;- 先日の新製品リリースのニュースを見ました&#10;- EC事業での集客が課題かと思います&#10;- 弊社のSNSマーケティングサービスで解決できます&#10;- A社様では3ヶ月でフォロワー5倍になりました&#10;- 一度お話しさせてください"
              />
              <p className="mt-2 text-xs text-gray-500">
                💡 箇条書き、メモ、既存の文章など、どんな形式でもOKです。AIが自動的にCxOレターの形式に整形します。
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="手紙を生成"
        >
          手紙を生成
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
