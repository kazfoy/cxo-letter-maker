import React, { useState } from 'react';
import { SALES_PLACEHOLDERS } from '@/lib/placeholders';
import { FIELD_LABELS, BUTTON_TEXTS, MESSAGES, TAB_LABELS, ICONS, REQUIRED_MARK } from '@/lib/constants';
import { Accordion } from '@/components/ui/Accordion';
import type { LetterFormData } from '@/types/letter';

interface SalesFormProps {
  formData: LetterFormData;
  inputMode: 'step' | 'freeform';
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleOpenMultiSourceModal: (type: 'own' | 'target') => void;
  handleAIAssist: (field: string) => void;
  handleOpenStructureSuggestion: () => void;
  setInputMode: (mode: 'step' | 'freeform') => void;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
}

export const SalesForm = React.memo(function SalesForm({
  formData,
  inputMode,
  handleChange,
  handleOpenMultiSourceModal,
  handleAIAssist,
  handleOpenStructureSuggestion,
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
      const res = await fetch('/api/news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: formData.companyName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      const trimmedResults = (data.results || '').trim();
      if (!trimmedResults) {
        alert('具体的なニュースファクトが見つかりませんでした。');
        return;
      }

      setFormData(prev => ({
        ...prev,
        searchResults: trimmedResults,
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
      {/* 最小入力セクション（常時表示） */}
      <div className="space-y-4">
        {/* 相手企業名 */}
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
            相手企業名 <span className="text-red-500">{REQUIRED_MARK}</span>
            <span className="text-xs text-slate-500 ml-2">（URLのみでも可）</span>
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
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

        {/* 相手企業URL */}
        <div>
          <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-700 mb-2">
            相手企業URL <span className="text-indigo-600 text-xs font-medium">（推奨）</span>
          </label>
          <input
            type="url"
            id="targetUrl"
            name="targetUrl"
            value={formData.targetUrl || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder="https://example.com（サンプル実行時は自動入力）"
          />
          <p className="mt-1 text-xs text-slate-500">
            <span className="text-indigo-600 font-medium">URLを入れると、ニュース・採用・IRなどから具体的な根拠を抽出</span>し、説得力のあるレターを作成できます
          </p>
        </div>

        {/* 自社サービス概要 */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="myServiceDescription" className="block text-sm font-medium text-gray-700">
              自社サービス概要 <span className="text-red-500">{REQUIRED_MARK}</span>
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
            id="myServiceDescription"
            name="myServiceDescription"
            value={formData.myServiceDescription}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder={SALES_PLACEHOLDERS.myServiceDescription}
            maxLength={300}
          />
        </div>

        {/* 宛名（任意、デフォルトご担当者様） */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
            宛名 <span className="text-xs text-slate-500">（未入力時は「ご担当者様」）</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder="例: 山田太郎 様（未入力時は「ご担当者様」）"
          />
        </div>
      </div>

      {/* 詳細入力セクション（アコーディオン） */}
      <div className="mt-6">
        <Accordion title="詳細を編集（差出人情報・ターゲット詳細・レター構成）" defaultExpanded={false}>
          <div className="space-y-6">
            {/* 差出人情報 */}
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
                    {FIELD_LABELS.myCompanyName}
                  </label>
                  <input
                    type="text"
                    id="myCompanyName"
                    name="myCompanyName"
                    value={formData.myCompanyName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.myCompanyName}
                  />
                </div>
                <div>
                  <label htmlFor="myDepartment" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.myDepartment}
                  </label>
                  <input
                    type="text"
                    id="myDepartment"
                    name="myDepartment"
                    value={formData.myDepartment || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.myDepartment}
                  />
                </div>
                <div>
                  <label htmlFor="myName" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.myName}
                  </label>
                  <input
                    type="text"
                    id="myName"
                    name="myName"
                    value={formData.myName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.myName}
                  />
                </div>
                {/* 商材の強み */}
                <div>
                  <label htmlFor="productStrength" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.productStrength}
                  </label>
                  <textarea
                    id="productStrength"
                    name="productStrength"
                    value={formData.productStrength || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder="例: 導入実績500社以上、業界シェアNo.1、独自の特許技術で他社比30%効率化"
                    maxLength={300}
                  />
                  <p className="mt-1 text-xs text-slate-500">競合との差別化ポイントや具体的な実績を記載すると効果的です</p>
                </div>
              </div>
            </div>

            {/* ターゲット詳細情報 */}
            <div className="border-b pb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-700">ターゲット詳細情報</h3>
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
                  <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.department}
                  </label>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    value={formData.department || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.department}
                  />
                </div>
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.position}
                  />
                </div>

                {/* ターゲットの課題 */}
                <div>
                  <label htmlFor="targetChallenges" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.targetChallenges}
                  </label>
                  <textarea
                    id="targetChallenges"
                    name="targetChallenges"
                    value={formData.targetChallenges || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder="例: DX推進の遅れ、人材不足、レガシーシステムの刷新、コンプライアンス対応"
                    maxLength={300}
                  />
                  <p className="mt-1 text-xs text-slate-500">把握している課題があれば記載すると、より刺さるレターになります</p>
                </div>

                {/* 検索結果の表示エリア（自動入力） */}
                {formData.searchResults && (
                  <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                    <label htmlFor="searchResults" className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <span>取得されたニュース情報</span>
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
                        {FIELD_LABELS.background}
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
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={SALES_PLACEHOLDERS.background}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="problem" className="block text-sm font-medium text-gray-700">
                        {FIELD_LABELS.problem}
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
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={SALES_PLACEHOLDERS.problem}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="solution" className="block text-sm font-medium text-gray-700">
                        {FIELD_LABELS.solution}
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
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={SALES_PLACEHOLDERS.solution}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="caseStudy" className="block text-sm font-medium text-gray-700">
                        {FIELD_LABELS.caseStudy}
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
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={SALES_PLACEHOLDERS.caseStudy}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="offer" className="block text-sm font-medium text-gray-700">
                        {FIELD_LABELS.offer}
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
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
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
                      {FIELD_LABELS.freeformInput}
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenStructureSuggestion}
                      className="text-sm bg-purple-50 text-purple-700 border border-purple-300 px-4 py-1.5 rounded-md hover:bg-purple-100 transition-colors font-medium flex items-center gap-1"
                      aria-label={BUTTON_TEXTS.structureSuggestion}
                    >
                      {BUTTON_TEXTS.structureSuggestion}
                    </button>
                  </div>
                  <textarea
                    id="freeformInput"
                    name="freeformInput"
                    value={formData.freeformInput || ''}
                    onChange={handleChange}
                    rows={15}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={SALES_PLACEHOLDERS.freeformInput}
                  />
                  <p className="mt-2 text-xs text-gray-500">{MESSAGES.info.freeformHelp}</p>
                </div>
              )}
            </div>
          </div>
        </Accordion>
      </div>
    </>
  );
});
