'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { InputForm } from '@/components/InputForm';
import { PreviewArea } from '@/components/PreviewArea';
import { Header } from '@/components/Header';
import { HistorySidebar } from '@/components/HistorySidebar';
import { saveToHistory } from '@/lib/supabaseHistoryUtils';
import { getProfile } from '@/lib/profileUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestLimit } from '@/hooks/useGuestLimit';
import { SAMPLE_DATA, SAMPLE_EVENT_DATA } from '@/lib/sampleData';
import type { LetterFormData, LetterMode, LetterStatus, LetterHistory } from '@/types/letter';
import { createClient } from '@/utils/supabase/client';

export default function NewLetterPage() {
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

  // 制限到達時にモーダルを表示
  useEffect(() => {
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
    }
  }, [usage, user]);

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
          setGeneratedLetter(data.content);
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
      setEmailData(response.email);
      // メールモードの場合は本文を保存するのが一般的だが、履歴には件名も含めたいかもしれない。
      // 一旦、本文をメインコンテンツとして保存し、詳細はJSONなどに保存すべきだが、
      // 既存の履歴DB構造(content: text)に合わせるため、"件名: ...\n\n本文..." の形式で保存するか、
      // あるいはメール本文のみ保存するか。
      // ここではわかりやすく結合して保存する。
      contentToSave = `件名: ${response.email.subject}\n\n${response.email.body}`;
      setGeneratedLetter(contentToSave); // プレビュー用には使わないが、一応セット
    } else {
      const letterText = response.letter || '';
      setGeneratedLetter(letterText);
      contentToSave = letterText;

      // バリエーションがあれば保存
      if (response.variations) {
        setVariations(response.variations);
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
  };

  const handleSampleExperience = async () => {
    // ゲスト制限チェック
    if (usage?.isLimitReached && !user) {
      setShowLimitModal(true);
      return;
    }

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
        // エラーレスポンスの本文を取得
        let errorData;
        try {
          errorData = await response.json();
          console.error('[ERROR] エラーレスポンス本文:', errorData);
        } catch (parseError) {
          console.error('[ERROR] レスポンス本文のパースに失敗:', parseError);
          const text = await response.text();
          console.error('[ERROR] レスポンステキスト:', text);
        }

        // 429エラーの場合は制限モーダルを表示
        if (response.status === 429) {
          setShowLimitModal(true);
          refetchGuestUsage();
          return;
        }

        throw new Error(`生成に失敗しました (${response.status}): ${errorData?.error || errorData?.message || response.statusText}`);
      }

      const data = await response.json();



      setGeneratedLetter(data.letter);

      // バリエーションがあれば保存
      if (data.variations) {
        setVariations(data.variations);
        setActiveVariation('standard'); // 生成後は標準をセット
      } else {
        setVariations(undefined);
      }

      if (user) {
        const savedLetter = await saveToHistory(sampleFormData, data.letter, mode);
        if (savedLetter) {
          setCurrentLetterId(savedLetter.id);
          setCurrentLetterStatus(savedLetter.status);
        }
      } else {
        // Guest save
        const { saveToGuestHistory } = await import('@/lib/guestHistoryUtils');
        const savedLetter = saveToGuestHistory(sampleFormData, data.letter, mode);
        setCurrentLetterId(savedLetter.id);
        setCurrentLetterStatus(savedLetter.status);
        window.dispatchEvent(new Event('guest-history-updated'));
      }
      // ゲスト利用状況を更新
      if (!user) {
        refetchGuestUsage();
      }
    } catch (error: any) {
      console.error('[ERROR] サンプル生成エラー詳細:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        fullError: error,
      });
      alert(`サンプルの生成に失敗しました。もう一度お試しください。\n\nエラー: ${error.message}`);
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
              <InputForm
                mode={mode}
                onGenerate={handleGenerate}
                setIsGenerating={setIsGenerating}
                formData={formData}
                setFormData={setFormData}
                onSampleFill={handleSampleExperience}
                onReset={handleResetOnly}
                disabled={!user && usage?.isLimitReached}

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
    </div>
  );
}
