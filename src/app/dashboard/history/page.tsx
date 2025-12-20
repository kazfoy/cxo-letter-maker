'use client';

import { useEffect, useState } from 'react';
import { getHistories, deleteHistory } from '@/lib/supabaseHistoryUtils';
import { useRouter } from 'next/navigation';
import type { LetterHistory, LetterStatus } from '@/types/letter';

export default function HistoryPage() {
  const router = useRouter();
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>('all');

  useEffect(() => {
    loadHistories();
  }, []);

  const loadHistories = async () => {
    try {
      const data = await getHistories();
      setHistories(data);
    } catch (error) {
      console.error('Failed to load histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この履歴を削除してもよろしいですか？')) return;

    try {
      const updated = await deleteHistory(id);
      setHistories(updated);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const filteredHistories = statusFilter === 'all'
    ? histories
    : histories.filter(h => (h.status || 'generated') === statusFilter);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">履歴一覧</h1>
        <p className="text-slate-600">作成した手紙の一覧を表示します</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <label htmlFor="status-filter" className="text-sm font-medium text-slate-700">
            ステータスで絞り込み:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LetterStatus | 'all')}
            className="px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">すべて表示</option>
            <option value="draft">下書き</option>
            <option value="generated">作成済</option>
            <option value="sent">送付済</option>
            <option value="replied">返信あり</option>
            <option value="meeting_set">アポ獲得</option>
          </select>
          <span className="text-sm text-slate-500">
            {filteredHistories.length}件
          </span>
        </div>
      </div>

      {/* History List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      ) : filteredHistories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-6xl mb-4">📂</p>
          <p className="text-slate-600 mb-2">履歴がありません</p>
          <p className="text-sm text-slate-500">手紙を作成すると、ここに表示されます</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-200">
          {filteredHistories.map((history) => (
            <div
              key={history.id}
              className="p-6 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => router.push(`/new?restore=${history.id}`)}>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{history.targetCompany}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      history.status === 'meeting_set' ? 'bg-green-100 text-green-700 border border-green-200' :
                      history.status === 'replied' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                      history.status === 'sent' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                      'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {history.status === 'meeting_set' ? 'アポ獲得' :
                       history.status === 'replied' ? '返信あり' :
                       history.status === 'sent' ? '送付済' : '作成済'}
                    </span>
                    {history.mode === 'event' && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                        Event
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mb-1">{history.targetName}様</p>
                  <p className="text-sm text-slate-500">
                    作成日時: {new Date(history.createdAt).toLocaleString('ja-JP')}
                  </p>
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                    {history.content.substring(0, 100)}...
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(history.id);
                  }}
                  className="ml-4 text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
