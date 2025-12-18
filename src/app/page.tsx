'use client';

import { useState } from 'react';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { saveToHistory, type LetterHistory } from '@/lib/historyUtils';

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
  freeformInput?: string; // まとめて入力用
  // イベント招待モード用フィールド
  eventUrl?: string; // イベントURL
  eventName?: string; // イベント名
  eventDateTime?: string; // 開催日時・場所
  eventSpeakers?: string; // 主要登壇者/ゲスト
  invitationReason?: string; // 招待の背景（Why You?）
}

export type LetterMode = 'sales' | 'event';

export default function Home() {
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<LetterMode>('sales');
  const [formData, setFormData] = useState<LetterFormData>({
    myCompanyName: '',
    myName: '',
    myServiceDescription: '',
    companyName: '',
    position: '',
    name: '',
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
  });

  const handleGenerate = (letter: string, data: LetterFormData) => {
    setGeneratedLetter(letter);
    // 履歴に保存
    saveToHistory(data, letter);
  };

  const handleRestore = (history: LetterHistory) => {
    setFormData(history.inputs);
    setGeneratedLetter(history.content);
  };

  const handleSaveAndReset = () => {
    // 履歴に保存（未生成でもOK）
    saveToHistory(formData, generatedLetter);

    // フォームリセット
    setFormData({
      myCompanyName: '',
      myName: '',
      myServiceDescription: '',
      companyName: '',
      position: '',
      name: '',
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
    });

    setGeneratedLetter('');
    alert('履歴に保存し、フォームをリセットしました');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* モード切り替えUI */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setMode('sales')}
              className={`px-6 py-3 font-medium transition-all ${
                mode === 'sales'
                  ? 'bg-blue-600 text-white border-b-2 border-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📧 セールスレターモード
            </button>
            <button
              onClick={() => setMode('event')}
              className={`px-6 py-3 font-medium transition-all ${
                mode === 'event'
                  ? 'bg-purple-600 text-white border-b-2 border-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🎫 イベント招待モード
            </button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側: 履歴サイドバー */}
          <div className="lg:col-span-3">
            <HistorySidebar onRestore={handleRestore} />
          </div>

          {/* 右側: メインコンテンツ */}
          <div className="lg:col-span-9 space-y-4">
            {/* 保存&リセットボタン */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <button
                onClick={handleSaveAndReset}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-md hover:from-green-700 hover:to-blue-700 transition-all font-medium shadow-sm"
              >
                💾 現在の内容を履歴に保存してリセット
              </button>
            </div>

            {/* 入力フォームとプレビューのグリッド */}
            <div className="grid grid-cols-1 lg:grid-cols-9 gap-6">
              {/* 中央: 入力フォーム */}
              <div className="lg:col-span-5">
                <InputForm
                  mode={mode}
                  onGenerate={handleGenerate}
                  setIsGenerating={setIsGenerating}
                  formData={formData}
                  setFormData={setFormData}
                />
              </div>

              {/* 右側: プレビューエリア */}
              <div className="lg:col-span-4">
                <PreviewArea
                  content={generatedLetter}
                  onContentChange={setGeneratedLetter}
                  isGenerating={isGenerating}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
