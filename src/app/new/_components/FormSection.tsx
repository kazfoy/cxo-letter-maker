'use client';

import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { InputForm } from '@/components/InputForm';
import { useLetterStore } from '@/stores/letterStore';
import { useTeamTemplates } from '@/hooks/useTeamTemplates';
import { useLetterActions } from './useLetterActions';

export function FormSection() {
  const {
    formData,
    setFormData,
    mode,
    isQuickDrafting,
    isAnalyzing,
    formErrors,
    clearFormError,
    setIsGenerating,
    generationError,
    generationErrorKind,
    setGenerationError,
    setGenerationErrorKind,
  } = useLetterStore();

  const {
    user,
    usage,
    ensureAnalysisThenGenerateV2,
    handleQuickDraft,
    handleAnalyzeAndGenerate,
    handleSampleExperience,
    handleResetOnly,
  } = useLetterActions();

  const { templates, isTeamPlan } = useTeamTemplates();
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSelectTemplate = (template: typeof templates[0]) => {
    const si = template.sender_info;
    setFormData((prev) => ({
      ...prev,
      myCompanyName: si.company_name || prev.myCompanyName,
      myDepartment: si.department || prev.myDepartment,
      myName: si.name || prev.myName,
      myServiceDescription: si.service_description || prev.myServiceDescription,
    }));
    setShowTemplates(false);
  };

  return (
    <>
      {/* テンプレート選択（チームプランのみ） */}
      {isTeamPlan && templates.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              チームテンプレートから入力
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>

          {showTemplates && (
            <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="w-full px-4 py-3 text-left hover:bg-amber-50 border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.sender_info.company_name} / {t.sender_info.name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 生成エラー表示 */}
      {generationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <span className="text-sm text-red-800">{generationError}</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {(generationErrorKind === 'network' || generationErrorKind === 'timeout' || generationErrorKind === 'server' || generationErrorKind === 'unknown') && (
                  <button
                    onClick={() => {
                      setGenerationError(null);
                      setGenerationErrorKind(null);
                    }}
                    className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                  >
                    もう一度試す
                  </button>
                )}
                {(generationErrorKind === 'url_not_found' || generationErrorKind === 'url_blocked' || generationErrorKind === 'timeout') && (
                  <button
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, targetUrl: '' }));
                      setGenerationError(null);
                      setGenerationErrorKind(null);
                    }}
                    className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                  >
                    URLなしで生成する
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => { setGenerationError(null); setGenerationErrorKind(null); }}
              className="text-red-500 hover:text-red-700 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <InputForm
        mode={mode}
        setIsGenerating={setIsGenerating}
        formData={formData}
        setFormData={setFormData}
        onSampleFill={handleSampleExperience}
        onReset={handleResetOnly}
        disabled={!user && usage?.isLimitReached}
        onGenerateV2={ensureAnalysisThenGenerateV2}
        onQuickDraft={handleQuickDraft}
        onAnalyzeAndGenerate={handleAnalyzeAndGenerate}
        isQuickDrafting={isQuickDrafting}
        isAnalyzing={isAnalyzing}
        guestRemaining={usage?.remaining}
        guestLimit={usage?.limit}
        isLoggedIn={!!user}
        formErrors={formErrors}
        onClearError={clearFormError}
      />
    </>
  );
}
