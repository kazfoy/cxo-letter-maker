'use client';

import { useState, useRef, useEffect } from 'react';
import type { LetterStatus } from '@/types/letter';
import { updateStatus } from '@/lib/supabaseHistoryUtils';

interface StatusDropdownProps {
  letterId: string;
  currentStatus: LetterStatus;
  onStatusChange?: (newStatus: LetterStatus) => void;
}

const STATUS_CONFIG: Record<LetterStatus, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  draft: { label: '下書き', bgColor: 'bg-gray-100', textColor: 'text-gray-700', borderColor: 'border-gray-200' },
  generated: { label: '作成済み', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  sent: { label: '送付済み', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
  replied: { label: '返信あり', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  meeting_set: { label: 'アポ獲得', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-200' },
  failed: { label: '失敗', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-200' },
  archived: { label: 'アーカイブ', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
};

const STATUS_OPTIONS: LetterStatus[] = ['draft', 'generated', 'sent', 'replied', 'meeting_set', 'archived'];

export function StatusDropdown({ letterId, currentStatus, onStatusChange }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<LetterStatus>(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleStatusChange = async (newStatus: LetterStatus) => {
    if (newStatus === status || isUpdating) return;

    setIsUpdating(true);
    try {
      const result = await updateStatus(letterId, newStatus);
      if (result) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else {
        alert('ステータスの更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('ステータスの更新中にエラーが発生しました');
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const config = STATUS_CONFIG[status];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-1`}
      >
        {config.label}
        {isUpdating ? (
          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && !isUpdating && (
        <div className="absolute z-10 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px] right-0">
          {STATUS_OPTIONS.map((option) => {
            const optionConfig = STATUS_CONFIG[option];
            const isActive = option === status;
            return (
              <button
                key={option}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(option);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                  isActive ? 'bg-slate-50' : ''
                }`}
              >
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${optionConfig.bgColor} ${optionConfig.textColor} border ${optionConfig.borderColor}`}>
                  {optionConfig.label}
                </span>
                {isActive && (
                  <svg className="w-4 h-4 text-indigo-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
