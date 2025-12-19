'use client';

import { useState } from 'react';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { saveToHistory, type LetterHistory } from '@/lib/historyUtils';
import { SAMPLE_DATA, SAMPLE_EVENT_DATA } from '@/lib/sampleData';

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
  // かんたんモード用フィールド
  simpleRequirement?: string; // 伝えたい要件
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
    simpleRequirement: '',
  });

  const handleGenerate = (letter: string, data: LetterFormData) => {
    setGeneratedLetter(letter);
    // 履歴に保存
    saveToHistory(data, letter, mode);
  };

  const handleRestore = (history: LetterHistory) => {
    setFormData(history.inputs);
    setGeneratedLetter(history.content);
  };

  const handleSaveAndReset = () => {
    // 履歴に保存（未生成でもOK）
    saveToHistory(formData, generatedLetter, mode);

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
      simpleRequirement: '',
    });

    setGeneratedLetter('');
    alert('履歴に保存し、フォームをリセットしました');
  };

  const handleSampleExperience = async () => {
    // モードに応じたサンプルデータを選択
    const sampleData = mode === 'sales' ? SAMPLE_DATA : SAMPLE_EVENT_DATA;

    // フォームにサンプルデータを入力
    const sampleFormData: LetterFormData = {
      myCompanyName: sampleData.myCompanyName,
      myName: sampleData.myName,
      myServiceDescription: sampleData.myServiceDescription,
      companyName: sampleData.companyName,
      position: sampleData.position,
      name: sampleData.name,
      background: mode === 'sales' ? SAMPLE_DATA.background : '',
      problem: mode === 'sales' ? SAMPLE_DATA.problem : '',
      solution: mode === 'sales' ? SAMPLE_DATA.solution : '',
      caseStudy: mode === 'sales' ? SAMPLE_DATA.caseStudy : '',
      offer: mode === 'sales' ? SAMPLE_DATA.offer : '',
      freeformInput: mode === 'sales' ? SAMPLE_DATA.freeformInput : '',
      eventUrl: mode === 'event' ? SAMPLE_EVENT_DATA.eventUrl : '',
      eventName: mode === 'event' ? SAMPLE_EVENT_DATA.eventName : '',
      eventDateTime: mode === 'event' ? SAMPLE_EVENT_DATA.eventDateTime : '',
      eventSpeakers: mode === 'event' ? SAMPLE_EVENT_DATA.eventSpeakers : '',
      invitationReason: mode === 'event' ? SAMPLE_EVENT_DATA.invitationReason : '',
      simpleRequirement: '',
    };

    setFormData(sampleFormData);
    setIsGenerating(true);

    try {
      // Generate letter with sample data
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sampleFormData,
          mode,
          inputComplexity: mode === 'sales' ? 'simple' : 'detailed',
        }),
      });

      if (!response.ok) {
        throw new Error('生成に失敗しました');
      }

      const data = await response.json();
      setGeneratedLetter(data.letter);
      saveToHistory(sampleFormData, data.letter, mode);
    } catch (error) {
      console.error('サンプル生成エラー:', error);
      alert('サンプルの生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* モード切り替えUI */}
      <div className="bg-white border-b sticky top-0 z-30">
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

      {/* 保存&リセットボタン */}
      <div className="bg-white border-b sticky top-[57px] z-30">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={handleSaveAndReset}
            className="w-full md:w-auto bg-gradient-to-r from-green-600 to-blue-600 text-white py-2 px-6 rounded-md hover:from-green-700 hover:to-blue-700 transition-all font-medium shadow-sm"
          >
            💾 現在の内容を履歴に保存してリセット
          </button>
        </div>
      </div>

      {/* 3カラムレイアウト（自然なスクロール） */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
          {/* 左側: 履歴サイドバー（Sticky追従） */}
          <div className="md:col-span-2 md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10">
            <HistorySidebar onRestore={handleRestore} onSampleExperience={handleSampleExperience} />
          </div>

          {/* 中央: 入力フォーム（自然に伸びる） */}
          <div className="md:col-span-5">
            <InputForm
              mode={mode}
              onGenerate={handleGenerate}
              setIsGenerating={setIsGenerating}
              formData={formData}
              setFormData={setFormData}
            />
          </div>

          {/* 右側: プレビューエリア（Sticky追従） */}
          <div className="md:col-span-5 md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10">
            <PreviewArea
              content={generatedLetter}
              onContentChange={setGeneratedLetter}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
