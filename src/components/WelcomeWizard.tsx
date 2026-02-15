'use client';

import React, { useState } from 'react';
import type { LetterMode } from '@/types/letter';

interface WelcomeWizardProps {
  onComplete: () => void;
  onSampleExperience: () => void;
  onModeChange: (mode: LetterMode) => void;
}

const MODES = [
  {
    id: 'sales' as LetterMode,
    label: 'セールスレター',
    description: '企業URLからAIが根拠を抽出し、説得力ある手紙を自動生成',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'event' as LetterMode,
    label: 'イベント招待',
    description: 'イベント情報と相手企業を分析し、パーソナライズされた招待状を作成',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'consulting' as LetterMode,
    label: '相談型レター',
    description: '課題解決型のアプローチで、信頼関係を築くレターを生成',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

const USE_STEPS = [
  {
    step: '1',
    title: '相手企業のURLを入力',
    description: 'コーポレートサイトやニュースページのURL',
  },
  {
    step: '2',
    title: 'AIが企業を分析',
    description: 'IR・ニュース・採用情報から根拠を自動抽出',
  },
  {
    step: '3',
    title: 'レターが完成',
    description: 'CxOが返信したくなる文面を30秒で生成',
  },
];

export function WelcomeWizard({ onComplete, onSampleExperience, onModeChange }: WelcomeWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<LetterMode>('sales');

  const handleModeSelect = (mode: LetterMode) => {
    setSelectedMode(mode);
    onModeChange(mode);
    setStep(2);
  };

  const handleSampleClick = () => {
    onComplete();
    onSampleExperience();
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 sm:p-6 mb-6 max-w-3xl mx-auto transition-opacity duration-300">
      {/* ステップインジケータ */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
              s === step ? 'bg-amber-600' : s < step ? 'bg-amber-300' : 'bg-stone-300'
            }`}
            aria-label={`ステップ ${s} / 3`}
          />
        ))}
      </div>

      {/* Step 1: レター種類選択 */}
      {step === 1 && (
        <div>
          <h3 className="text-lg font-bold text-stone-900 text-center mb-1">
            どんなレターを作りますか？
          </h3>
          <p className="text-sm text-stone-500 text-center mb-5">
            目的に合わせて最適なテンプレートで生成します
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeSelect(m.id)}
                className={`text-left p-4 rounded-lg border-2 transition-all hover:border-amber-400 hover:bg-amber-50 ${
                  selectedMode === m.id ? 'border-amber-500 bg-amber-50' : 'border-stone-200'
                }`}
              >
                <div className="text-amber-700 mb-2">{m.icon}</div>
                <p className="font-semibold text-stone-900 text-sm mb-1">{m.label}</p>
                <p className="text-xs text-stone-500 leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: URL説明 */}
      {step === 2 && (
        <div>
          <h3 className="text-lg font-bold text-stone-900 text-center mb-1">
            URLを入れるだけでAIが分析
          </h3>
          <p className="text-sm text-stone-500 text-center mb-5">
            企業のWebサイトから根拠を自動抽出します
          </p>
          <div className="space-y-3 mb-6">
            {USE_STEPS.map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <p className="font-medium text-stone-900 text-sm">{s.title}</p>
                  <p className="text-xs text-stone-500">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-amber-800 text-white rounded-lg font-medium text-sm hover:bg-amber-900 transition-colors"
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {/* Step 3: サンプル体験 */}
      {step === 3 && (
        <div className="text-center">
          <h3 className="text-lg font-bold text-stone-900 mb-1">
            まずはサンプルで試してみましょう
          </h3>
          <p className="text-sm text-stone-500 mb-6">
            実在する企業データを使って、レター生成を体験できます
          </p>
          <button
            type="button"
            onClick={handleSampleClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-800 text-white rounded-lg font-bold text-sm hover:bg-amber-900 transition-all shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            サンプルで試してみる
          </button>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors mr-4"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              スキップして自分で入力
            </button>
          </div>
        </div>
      )}

      {/* スキップリンク（Step 1, 2共通） */}
      {step < 3 && (
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            スキップ
          </button>
        </div>
      )}
    </div>
  );
}
