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
}

export default function Home() {
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
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
    });

    setGeneratedLetter('');
    alert('履歴に保存し、フォームをリセットしました');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
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
