'use client';

import { useEffect, useState } from 'react';
import { getHistories, deleteHistory, getBatches } from '@/lib/supabaseHistoryUtils';
import { useRouter } from 'next/navigation';
import type { LetterHistory, LetterStatus } from '@/types/letter';
import Link from 'next/link';
import { StatusDropdown } from '@/components/StatusDropdown';

interface BatchSummary {
  batchId: string;
  createdAt: string;
  count: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [histData, batchData] = await Promise.all([
        getHistories(),
        getBatches()
      ]);
      setHistories(histData);
      setBatches(batchData);
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
            <option value="generated">作成済み</option>
            <option value="sent">送付済み</option>
            <option value="replied">返信あり</option>
            <option value="meeting_set">アポ獲得</option>
            <option value="failed">失敗</option>
            <option value="archived">アーカイブ</option>
          </select>
          <span className="text-sm text-slate-500">
            {filteredHistories.length}件
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Batches Section */}
          {batches.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                一括生成履歴
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-200">
                {batches.map((batch) => (
                  <Link
                    key={batch.batchId}
                    href={`/dashboard/history/batch/${batch.batchId}`}
                    className="block p-6 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                            一括生成タスク ({batch.count}件)
                          </h3>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Batch
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          実施日時: {new Date(batch.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <div className="flex items-center text-indigo-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                        詳細を見る
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Individual History List */}
          <div className="space-y-4">
            {batches.length > 0 && <h2 className="text-lg font-bold text-slate-800">個別生成履歴</h2>}
            {filteredHistories.length === 0 ? (
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
                          <StatusDropdown
                            letterId={history.id}
                            currentStatus={history.status || 'generated'}
                            onStatusChange={(newStatus) => {
                              // Update local state immediately for better UX
                              setHistories(prev => prev.map(h =>
                                h.id === history.id ? { ...h, status: newStatus } : h
                              ));
                            }}
                          />
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
        </div>
      )}
    </div>
  );
}
