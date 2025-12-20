'use client';

import { useState, useEffect } from 'react';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { saveToHistory, type LetterHistory, type LetterStatus } from '@/lib/supabaseHistoryUtils';
import { getProfile } from '@/lib/profileUtils';
import { useAuth } from '@/contexts/AuthContext';
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

export default function NewLetterPage() {
  const { user } = useAuth();
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<LetterMode>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentLetterId, setCurrentLetterId] = useState<string | undefined>();
  const [currentLetterStatus, setCurrentLetterStatus] = useState<LetterStatus | undefined>();
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
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

  const handleGenerate = async (letter: string, data: LetterFormData) => {
    setGeneratedLetter(letter);
    // 履歴に保存
    const savedLetter = await saveToHistory(data, letter, mode);
    if (savedLetter) {
      setCurrentLetterId(savedLetter.id);
      setCurrentLetterStatus(savedLetter.status);
    }
  };

  const handleRestore = (history: LetterHistory) => {
    setFormData(history.inputs);
    setGeneratedLetter(history.content);
    setCurrentLetterId(history.id);
    setCurrentLetterStatus(history.status);
  };

  const handleSaveAndReset = async () => {
    // 履歴に保存（未生成でもOK）
    await saveToHistory(formData, generatedLetter, mode);

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
    setCurrentLetterId(undefined);
    setCurrentLetterStatus(undefined);
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
      const savedLetter = await saveToHistory(sampleFormData, data.letter, mode);
      if (savedLetter) {
        setCurrentLetterId(savedLetter.id);
        setCurrentLetterStatus(savedLetter.status);
      }
    } catch (error) {
      console.error('サンプル生成エラー:', error);
      alert('サンプルの生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
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
          </div>
        </div>
      </div>

      {/* 保存&リセットボタン */}
      <div className="bg-white border-b sticky top-[57px] z-30 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={handleSaveAndReset}
            className="w-full md:w-auto bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 transition-all font-medium shadow-sm"
          >
            💾 現在の内容を履歴に保存してリセット
          </button>
        </div>
      </div>

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
              />
            </div>

            {/* 中央: 入力フォーム（自然に伸びる） */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} transition-all duration-300`}>
              <InputForm
                mode={mode}
                onGenerate={handleGenerate}
                setIsGenerating={setIsGenerating}
                formData={formData}
                setFormData={setFormData}
                onSampleFill={handleSampleExperience}
              />
            </div>

            {/* 右側: プレビューエリア（Sticky追従） */}
            <div className={`${isSidebarOpen ? 'md:col-span-5' : 'md:col-span-6'} md:sticky md:top-[125px] md:max-h-[calc(100vh-140px)] md:overflow-y-auto z-10 transition-all duration-300`}>
              <PreviewArea
                content={generatedLetter}
                onContentChange={setGeneratedLetter}
                isGenerating={isGenerating}
                currentLetterId={currentLetterId}
                currentStatus={currentLetterStatus}
                onStatusChange={() => setRefreshHistoryTrigger(prev => prev + 1)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
