import React from 'react';
import { EVENT_PLACEHOLDERS } from '@/lib/placeholders';
import { FIELD_LABELS, BUTTON_TEXTS, MESSAGES, TAB_LABELS, ICONS, REQUIRED_MARK } from '@/lib/constants';
import type { LetterFormData } from '@/types/letter';

interface EventFormProps {
  formData: LetterFormData;
  inputMode: 'step' | 'freeform';
  isAnalyzingSource: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleOpenMultiSourceModal: (type: 'own' | 'target') => void;
  handleAIAssist: (field: string) => void;
  handleAnalyzeEventUrl: () => void;
  setInputMode: (mode: 'step' | 'freeform') => void;
}

export const EventForm = React.memo(function EventForm({
  formData,
  inputMode,
  isAnalyzingSource,
  handleChange,
  handleOpenMultiSourceModal,
  handleAIAssist,
  handleAnalyzeEventUrl,
  setInputMode,
}: EventFormProps) {
  return (
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
              className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
              placeholder={EVENT_PLACEHOLDERS.myCompanyName}
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
              placeholder={EVENT_PLACEHOLDERS.myDepartment}
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
              className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
              placeholder={EVENT_PLACEHOLDERS.myName}
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
              className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
              placeholder={EVENT_PLACEHOLDERS.myServiceDescription}
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
              className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
              placeholder={EVENT_PLACEHOLDERS.companyName}
            />
          </div>
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
              placeholder={EVENT_PLACEHOLDERS.department}
            />
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
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.position}
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
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.name}
              />
            </div>
          </div>
        </div>
      </div>

      {/* イベント情報セクション */}
      <div className="border-b pb-4">
        <h3 className="font-medium text-gray-700 mb-3">イベント情報</h3>

        {/* タブUI */}
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setInputMode('step')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${inputMode === 'step'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {TAB_LABELS.stepInputDetailed}
          </button>
          <button
            type="button"
            onClick={() => setInputMode('freeform')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${inputMode === 'freeform'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {TAB_LABELS.freeformInput}
          </button>
        </div>

        {/* ステップ入力モード */}
        {inputMode === 'step' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="eventUrl" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.eventUrl}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  id="eventUrl"
                  name="eventUrl"
                  value={formData.eventUrl || ''}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                  placeholder={EVENT_PLACEHOLDERS.eventUrl}
                />
                <button
                  type="button"
                  onClick={handleAnalyzeEventUrl}
                  disabled={!formData.eventUrl || isAnalyzingSource}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                >
                  {isAnalyzingSource ? BUTTON_TEXTS.analyzing : BUTTON_TEXTS.autoAnalyze}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="eventName" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.eventName} <span className="text-red-500">{REQUIRED_MARK}</span>
              </label>
              <input
                type="text"
                id="eventName"
                name="eventName"
                value={formData.eventName || ''}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.eventName}
              />
            </div>

            <div>
              <label htmlFor="eventDateTime" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.eventDateTime} <span className="text-red-500">{REQUIRED_MARK}</span>
              </label>
              <input
                type="text"
                id="eventDateTime"
                name="eventDateTime"
                value={formData.eventDateTime || ''}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.eventDateTime}
              />
            </div>

            <div>
              <label htmlFor="eventSpeakers" className="block text-sm font-medium text-slate-700 mb-2">
                {FIELD_LABELS.eventSpeakers}
              </label>
              <textarea
                id="eventSpeakers"
                name="eventSpeakers"
                value={formData.eventSpeakers || ''}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.eventSpeakers}
                maxLength={300}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="invitationReason" className="block text-sm font-medium text-gray-700">
                  {FIELD_LABELS.invitationReason} <span className="text-red-500">{REQUIRED_MARK}</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleAIAssist('invitationReason')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  aria-label={BUTTON_TEXTS.aiAssist}
                >
                  {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                </button>
              </div>
              <textarea
                id="invitationReason"
                name="invitationReason"
                value={formData.invitationReason || ''}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.invitationReason}
                maxLength={500}
              />
            </div>
          </div>
        )}

        {/* まとめて入力モード */}
        {inputMode === 'freeform' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4 mb-4">
              <p className="text-sm text-purple-800">{MESSAGES.info.eventFreeformMode}</p>
            </div>

            <div>
              <label htmlFor="eventUrlFreeform" className="block text-sm font-medium text-slate-700 mb-2">
                1. {FIELD_LABELS.eventUrl} <span className="text-red-500">{REQUIRED_MARK}</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  id="eventUrlFreeform"
                  name="eventUrl"
                  value={formData.eventUrl || ''}
                  onChange={handleChange}
                  required={inputMode === 'freeform'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-500"
                  placeholder={EVENT_PLACEHOLDERS.eventUrlFreeform}
                />
                <button
                  type="button"
                  onClick={handleAnalyzeEventUrl}
                  disabled={!formData.eventUrl || isAnalyzingSource}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                >
                  {isAnalyzingSource ? BUTTON_TEXTS.analyzing : BUTTON_TEXTS.autoAnalyze}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{MESSAGES.info.eventUrlHelp}</p>
            </div>

            <div>
              <label htmlFor="companyNameFreeform" className="block text-sm font-medium text-slate-700 mb-2">
                2. ターゲット企業名 <span className="text-red-500">{REQUIRED_MARK}</span>
              </label>
              <input
                type="text"
                id="companyNameFreeform"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required={inputMode === 'freeform'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.companyNameFreeform}
              />
            </div>

            <div>
              <label htmlFor="invitationMemo" className="block text-sm font-medium text-slate-700 mb-2">
                3. 誘いたい理由・メモ（任意）
              </label>
              <textarea
                id="invitationMemo"
                name="invitationReason"
                value={formData.invitationReason || ''}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.invitationMemo}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{MESSAGES.info.invitationMemoHelp}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
});
