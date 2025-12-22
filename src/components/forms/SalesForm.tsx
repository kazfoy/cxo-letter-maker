import React, { useState } from 'react';
import { SALES_PLACEHOLDERS } from '@/lib/placeholders';
import { FIELD_LABELS, BUTTON_TEXTS, MESSAGES, TAB_LABELS, ICONS, REQUIRED_MARK } from '@/lib/constants';
import type { LetterFormData, InputComplexity } from '@/types/letter';

interface SalesFormProps {
  formData: LetterFormData;
  inputComplexity: InputComplexity;
  inputMode: 'step' | 'freeform';
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleOpenMultiSourceModal: (type: 'own' | 'target') => void;
  handleAIAssist: (field: string) => void;
  handleOpenStructureSuggestion: () => void;
  setInputComplexity: (complexity: InputComplexity) => void;
  setInputMode: (mode: 'step' | 'freeform') => void;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
}

export const SalesForm = React.memo(function SalesForm({
  formData,
  inputComplexity,
  inputMode,
  handleChange,
  handleOpenMultiSourceModal,
  handleAIAssist,
  handleOpenStructureSuggestion,
  setInputComplexity,
  setInputMode,
  setFormData,
}: SalesFormProps) {
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchNews = async () => {
    if (!formData.companyName) {
      alert('企業名を入力してください');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch('/api/search-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: formData.companyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      setFormData(prev => ({
        ...prev,
        searchResults: data.results,
      }));

      alert('最新ニュースを取得しました。「生成」時に活用されます。');

    } catch (error) {
      console.error('Search error:', error);
      alert('ニュースの取得に失敗しました');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      {/* 入力複雑度切り替えタブ */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setInputComplexity('simple')}
          className={`px-6 py-2.5 font-medium text-sm transition-colors ${inputComplexity === 'simple'
            ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          {TAB_LABELS.simpleMode}
        </button>
        <button
          type="button"
          onClick={() => setInputComplexity('detailed')}
          className={`px-6 py-2.5 font-medium text-sm transition-colors ${inputComplexity === 'detailed'
            ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          {TAB_LABELS.detailedMode}
        </button>
      </div>

      {/* かんたんモードのフォーム */}
      {inputComplexity === 'simple' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-sm text-blue-800">{MESSAGES.info.simpleMode}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="simpleCompanyName" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.simpleCompanyName} <span className="text-red-500">{REQUIRED_MARK}</span>
              </label>
              <input
                type="text"
                id="simpleCompanyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                placeholder={SALES_PLACEHOLDERS.companyName}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleSearchNews}
                  disabled={isSearching}
                  className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isSearching ? '検索中...' : '🔍 最新ニュースを検索'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="simpleServiceDescription" className="block text-sm font-medium text-gray-700">
                  {FIELD_LABELS.simpleServiceDescription} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenMultiSourceModal('own')}
                  className="bg-green-50 text-green-700 border border-green-300 px-3 py-1 rounded-md hover:bg-green-100 transition-colors text-xs font-medium"
                  aria-label={BUTTON_TEXTS.ownHpShort}
                >
                  {ICONS.ownHp} {BUTTON_TEXTS.ownHpShort}
                </button>
              </div>
              <textarea
                id="simpleServiceDescription"
                name="myServiceDescription"
                value={formData.myServiceDescription}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                placeholder={SALES_PLACEHOLDERS.myServiceDescription}
                maxLength={300}
              />
            </div>

            <div>
              <label htmlFor="simpleRequirement" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.simpleRequirement}
              </label>
              <input
                type="text"
                id="simpleRequirement"
                name="simpleRequirement"
                value={formData.simpleRequirement || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                placeholder={SALES_PLACEHOLDERS.simpleRequirement}
                maxLength={100}
              />
              <p className="mt-1 text-xs text-gray-500">{MESSAGES.info.simpleRequirementHelp}</p>
            </div>
          </div>
        </>
      )}

      {/* 詳細モードのフォーム */}
      {inputComplexity === 'detailed' && (
        <>
          {/* 自社情報 */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-700">差出人（自社）情報</h3>
              <button
                type="button"
                onClick={() => handleOpenMultiSourceModal('own')}
                className="bg-green-50 text-green-700 border border-green-300 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
                aria-label={BUTTON_TEXTS.ownHp}
              >
                {ICONS.ownHp} {BUTTON_TEXTS.ownHp}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="myCompanyName" className="block text-sm font-medium text-slate-700 mb-2">
                  {FIELD_LABELS.myCompanyName} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <input
                  type="text"
                  id="myCompanyName"
                  name="myCompanyName"
                  value={formData.myCompanyName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  placeholder={SALES_PLACEHOLDERS.myCompanyName}
                />
              </div>
              <div>
                <label htmlFor="myName" className="block text-sm font-medium text-slate-700 mb-2">
                  {FIELD_LABELS.myName} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <input
                  type="text"
                  id="myName"
                  name="myName"
                  value={formData.myName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  placeholder={SALES_PLACEHOLDERS.myName}
                />
              </div>
              <div>
                <label htmlFor="myServiceDescription" className="block text-sm font-medium text-slate-700 mb-2">
                  {FIELD_LABELS.myServiceDescription} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <textarea
                  id="myServiceDescription"
                  name="myServiceDescription"
                  value={formData.myServiceDescription}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  placeholder={SALES_PLACEHOLDERS.myServiceDescription}
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
                aria-label={BUTTON_TEXTS.targetHp}
              >
                {ICONS.targetHp} {BUTTON_TEXTS.targetHp}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
                  {FIELD_LABELS.companyName} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  placeholder={SALES_PLACEHOLDERS.companyName}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleSearchNews}
                    disabled={isSearching}
                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSearching ? '検索中...' : '🔍 最新ニュースを検索'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.position}
                  </label>
                  <input
                    type="text"
                    id="position"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.position}
                  />
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.name} <span className="text-red-500">{REQUIRED_MARK}</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.name}
                  />
                </div>
              </div>

              {/* 検索結果の表示エリア（自動入力） */}
              {formData.searchResults && (
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                  <label htmlFor="searchResults" className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <span>🔍 取得されたニュース情報</span>
                    <span className="text-xs text-slate-500 font-normal">（生成時に背景として使用されます・編集可）</span>
                  </label>
                  <textarea
                    id="searchResults"
                    name="searchResults"
                    value={formData.searchResults}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
                    placeholder="検索結果がここに表示されます"
                  />
                </div>
              )}
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
                className={`px-4 py-2 font-medium text-sm transition-colors ${inputMode === 'step'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {TAB_LABELS.stepInput}
              </button>
              <button
                type="button"
                onClick={() => setInputMode('freeform')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${inputMode === 'freeform'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {TAB_LABELS.freeformInput}
              </button>
            </div>

            {/* ステップ入力モード */}
            {inputMode === 'step' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="background" className="block text-sm font-medium text-gray-700">
                      {FIELD_LABELS.background} <span className="text-red-500">{REQUIRED_MARK}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAIAssist('background')}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.aiAssist}
                    >
                      {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                    </button>
                  </div>
                  <textarea
                    id="background"
                    name="background"
                    value={formData.background}
                    onChange={handleChange}
                    required={inputMode === 'step'}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.background}
                    maxLength={500}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="problem" className="block text-sm font-medium text-gray-700">
                      {FIELD_LABELS.problem} <span className="text-red-500">{REQUIRED_MARK}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAIAssist('problem')}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.aiAssist}
                    >
                      {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                    </button>
                  </div>
                  <textarea
                    id="problem"
                    name="problem"
                    value={formData.problem}
                    onChange={handleChange}
                    required={inputMode === 'step'}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.problem}
                    maxLength={500}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="solution" className="block text-sm font-medium text-gray-700">
                      {FIELD_LABELS.solution} <span className="text-red-500">{REQUIRED_MARK}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAIAssist('solution')}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.aiAssist}
                    >
                      {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                    </button>
                  </div>
                  <textarea
                    id="solution"
                    name="solution"
                    value={formData.solution}
                    onChange={handleChange}
                    required={inputMode === 'step'}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.solution}
                    maxLength={500}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="caseStudy" className="block text-sm font-medium text-gray-700">
                      {FIELD_LABELS.caseStudy} <span className="text-red-500">{REQUIRED_MARK}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAIAssist('caseStudy')}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.aiAssist}
                    >
                      {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                    </button>
                  </div>
                  <textarea
                    id="caseStudy"
                    name="caseStudy"
                    value={formData.caseStudy}
                    onChange={handleChange}
                    required={inputMode === 'step'}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                    placeholder={SALES_PLACEHOLDERS.caseStudy}
                    maxLength={500}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="offer" className="block text-sm font-medium text-gray-700">
                      {FIELD_LABELS.offer} <span className="text-red-500">{REQUIRED_MARK}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAIAssist('offer')}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.aiAssist}
                    >
                      {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                    </button>
                  </div>
                  <textarea
                    id="offer"
                    name="offer"
                    value={formData.offer}
                    onChange={handleChange}
                    required={inputMode === 'step'}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
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
                    {FIELD_LABELS.freeformInput} <span className="text-red-500">{REQUIRED_MARK}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenStructureSuggestion}
                    className="text-sm bg-purple-50 text-purple-700 border border-purple-300 px-4 py-1.5 rounded-md hover:bg-purple-100 transition-colors font-medium flex items-center gap-1"
                    aria-label={BUTTON_TEXTS.structureSuggestion}
                  >
                    💡 {BUTTON_TEXTS.structureSuggestion}
                  </button>
                </div>
                <textarea
                  id="freeformInput"
                  name="freeformInput"
                  value={formData.freeformInput || ''}
                  onChange={handleChange}
                  required={inputMode === 'freeform'}
                  rows={15}
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  placeholder={SALES_PLACEHOLDERS.freeformInput}
                />
                <p className="mt-2 text-xs text-gray-500">{MESSAGES.info.freeformHelp}</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
});
