import React, { useState, useCallback } from 'react';
import { EVENT_PLACEHOLDERS } from '@/lib/placeholders';
import { FIELD_LABELS, BUTTON_TEXTS, ICONS, REQUIRED_MARK } from '@/lib/constants';
import { Accordion } from '@/components/ui/Accordion';
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
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
}

export const EventForm = React.memo(function EventForm({
  formData,
  isAnalyzingSource,
  handleChange,
  handleOpenMultiSourceModal,
  handleAIAssist,
  setFormData,
}: EventFormProps) {
  const [isAnalyzingEventUrl, setIsAnalyzingEventUrl] = useState(false);
  const [eventUrlError, setEventUrlError] = useState<string | null>(null);

  // イベントURL解析（blur時に自動実行）
  const handleEventUrlBlur = useCallback(async () => {
    const eventUrl = formData.eventUrl?.trim();
    if (!eventUrl) return;

    // 既に情報が入力されている場合はスキップ
    if (formData.eventName && formData.eventDateTime) return;

    // URL形式チェック
    try {
      new URL(eventUrl);
    } catch {
      return; // 無効なURLは無視
    }

    setIsAnalyzingEventUrl(true);
    setEventUrlError(null);

    try {
      const response = await fetch('/api/analyze-event-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_url: eventUrl }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // 自動補完（空のフィールドのみ）
        setFormData(prev => ({
          ...prev,
          eventName: prev.eventName || data.data.eventName || '',
          eventDateTime: prev.eventDateTime || data.data.eventDateTime || '',
          eventSpeakers: prev.eventSpeakers || data.data.eventSpeakers || '',
        }));
      } else {
        setEventUrlError(data.message || 'イベント情報を取得できませんでした');
      }
    } catch (error) {
      console.error('Event URL analysis failed:', error);
      setEventUrlError('イベント情報の取得に失敗しました。手動で入力してください。');
    } finally {
      setIsAnalyzingEventUrl(false);
    }
  }, [formData.eventUrl, formData.eventName, formData.eventDateTime, setFormData]);

  return (
    <>
      {/* 最小入力セクション（常時表示） */}
      <div className="space-y-4">
        {/* 相手企業名 */}
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
            相手企業名 <span className="text-red-500">{REQUIRED_MARK}</span>
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder={EVENT_PLACEHOLDERS.companyName}
          />
        </div>

        {/* 相手企業URL（推奨） */}
        <div>
          <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-700 mb-2">
            相手企業URL <span className="text-purple-600 text-xs font-medium">（推奨）</span>
          </label>
          <input
            type="url"
            id="targetUrl"
            name="targetUrl"
            value={formData.targetUrl || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder="https://example.com（招待先企業のURL）"
          />
          <p className="mt-1 text-xs text-slate-500">
            <span className="text-purple-600 font-medium">URLを入れると、相手企業の情報を分析</span>して説得力のある招待状を作成できます
          </p>
        </div>

        {/* イベントURL（推奨・自動解析） */}
        <div>
          <label htmlFor="eventUrl" className="block text-sm font-medium text-slate-700 mb-2">
            イベントURL <span className="text-purple-600 text-xs font-medium">（推奨・自動解析）</span>
          </label>
          <div className="relative">
            <input
              type="url"
              id="eventUrl"
              name="eventUrl"
              value={formData.eventUrl || ''}
              onChange={handleChange}
              onBlur={handleEventUrlBlur}
              className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
              placeholder={EVENT_PLACEHOLDERS.eventUrl}
            />
            {isAnalyzingEventUrl && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              </div>
            )}
          </div>
          {eventUrlError ? (
            <p className="mt-1 text-xs text-amber-600">{eventUrlError}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">URLを入れるとイベント名・日時などを自動取得します</p>
          )}
        </div>

        {/* 招待の目的ひとこと（任意） */}
        <div>
          <label htmlFor="invitationReason" className="block text-sm font-medium text-slate-700 mb-2">
            招待の目的ひとこと <span className="text-xs text-slate-500">（任意）</span>
          </label>
          <textarea
            id="invitationReason"
            name="invitationReason"
            value={formData.invitationReason || ''}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder="例: 弊社の新サービスと御社の課題がマッチすると考え、ご招待したい"
            maxLength={300}
          />
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
            className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
            placeholder={EVENT_PLACEHOLDERS.myServiceDescription}
            maxLength={300}
          />
        </div>
      </div>

      {/* 詳細入力セクション（アコーディオン） */}
      <div className="mt-6">
        <Accordion title="詳細を編集（イベント情報・差出人・宛先詳細）" defaultExpanded={false}>
          <div className="space-y-6">
            {/* イベント詳細情報 */}
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-3">イベント情報</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="eventName" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.eventName}
                  </label>
                  <input
                    type="text"
                    id="eventName"
                    name="eventName"
                    value={formData.eventName || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={EVENT_PLACEHOLDERS.eventName}
                  />
                </div>

                <div>
                  <label htmlFor="eventDateTime" className="block text-sm font-medium text-slate-700 mb-2">
                    {FIELD_LABELS.eventDateTime}
                  </label>
                  <input
                    type="text"
                    id="eventDateTime"
                    name="eventDateTime"
                    value={formData.eventDateTime || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={EVENT_PLACEHOLDERS.eventSpeakers}
                    maxLength={300}
                  />
                </div>
              </div>
            </div>

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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={EVENT_PLACEHOLDERS.myDepartment}
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                    placeholder={EVENT_PLACEHOLDERS.myName}
                  />
                </div>
              </div>
            </div>

            {/* ターゲット詳細情報 */}
            <div className="border-b pb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-700">宛先詳細情報</h3>
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={EVENT_PLACEHOLDERS.position}
                    />
                  </div>
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                      placeholder={EVENT_PLACEHOLDERS.name}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 招待理由詳細（AIアシスト付き） */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="invitationReasonDetail" className="block text-sm font-medium text-gray-700">
                  招待理由（詳細）
                </label>
                <button
                  type="button"
                  onClick={() => handleAIAssist('invitationReason')}
                  disabled={isAnalyzingSource}
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
                  aria-label={BUTTON_TEXTS.aiAssist}
                >
                  {ICONS.aiAssist} {BUTTON_TEXTS.aiAssist}
                </button>
              </div>
              <textarea
                id="invitationReasonDetail"
                name="invitationReason"
                value={formData.invitationReason || ''}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-slate-900 placeholder:text-slate-500"
                placeholder={EVENT_PLACEHOLDERS.invitationReason}
                maxLength={500}
              />
            </div>
          </div>
        </Accordion>
      </div>
    </>
  );
});
