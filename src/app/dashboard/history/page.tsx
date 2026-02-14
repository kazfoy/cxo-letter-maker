'use client';

import { useEffect, useState, useRef } from 'react';
import { getHistories, deleteHistory, getBatches, getActiveBatchJobs } from '@/lib/supabaseHistoryUtils';
import { useRouter } from 'next/navigation';
import type { LetterHistory, LetterStatus } from '@/types/letter';
import Link from 'next/link';
import { StatusDropdown } from '@/components/StatusDropdown';
import { Loader2, XCircle, AlertCircle } from 'lucide-react'; // Added icons
import { devLog } from '@/lib/logger';

interface BatchSummary {
  batchId: string;
  createdAt: string;
  count: number;
}

interface ActiveJob {
  id: string;
  totalCount: number;
  processedCount: number;
  failureCount: number;
  createdAt: string;
  status: string;
  errorMessage?: string;
}

type OutputFormat = 'all' | 'letter' | 'mail';

export default function HistoryPage() {
  const router = useRouter();
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<OutputFormat>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const prevActiveCountRef = useRef(0);

  useEffect(() => {
    loadData();

    // Poll for active jobs every 3 seconds
    const interval = setInterval(() => {
      refreshActiveJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Track active jobs count to auto-reload when jobs finish
  useEffect(() => {
    if (activeJobs.length < prevActiveCountRef.current) {
      // Jobs decreased (finished/cancelled), reload lists
      loadData();
    }
    prevActiveCountRef.current = activeJobs.length;
  }, [activeJobs]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [histData, batchData] = await Promise.all([
        getHistories(),
        getBatches()
      ]);
      setHistories(histData);
      setBatches(batchData);

      const activeData = await getActiveBatchJobs();
      setActiveJobs(activeData);
    } catch (error) {
      devLog.error('Failed to load histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveJobs = async () => {
    // Silent update
    const activeData = await getActiveBatchJobs();
    setActiveJobs(activeData);
  };

  const handleCancelJob = async (batchId: string) => {
    if (!confirm('この生成ジョブを中断してもよろしいですか？')) return;
    try {
      const response = await fetch(`/api/batch-jobs/${batchId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        // Wait a bit and reload
        setTimeout(loadData, 1000);
      }
    } catch (err) {
      devLog.error('Failed to cancel job:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この履歴を削除してもよろしいですか？')) return;

    try {
      const updated = await deleteHistory(id);
      setHistories(updated);
    } catch (error) {
      devLog.error('Failed to delete:', error);
    }
  };

  const filteredHistories = histories.filter(h => {
    // Status filter
    if (statusFilter !== 'all' && (h.status || 'generated') !== statusFilter) {
      return false;
    }

    // Format filter (Letter/Mail)
    if (formatFilter !== 'all') {
      const isEmail = !!h.emailContent;
      if (formatFilter === 'mail' && !isEmail) return false;
      if (formatFilter === 'letter' && isEmail) return false;
    }

    // Keyword search (company name or target name)
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      const matchesCompany = h.targetCompany.toLowerCase().includes(keyword);
      const matchesName = h.targetName.toLowerCase().includes(keyword);
      if (!matchesCompany && !matchesName) return false;
    }

    return true;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">履歴一覧</h1>
        <p className="text-slate-600">作成した手紙の一覧を表示します</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="space-y-4">
          {/* Row 1: Format & Status Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Format Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="format-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">
                種別:
              </label>
              <div className="flex gap-1 bg-slate-100 rounded-md p-1">
                <button
                  onClick={() => setFormatFilter('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${formatFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setFormatFilter('letter')}
                  className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${formatFilter === 'letter'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  手紙
                </button>
                <button
                  onClick={() => setFormatFilter('mail')}
                  className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${formatFilter === 'mail'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  メール
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">
                ステータス:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LetterStatus | 'all')}
                className="px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">すべて</option>
                <option value="draft">下書き</option>
                <option value="generated">作成済み</option>
                <option value="sent">送付済み</option>
                <option value="replied">返信あり</option>
                <option value="meeting_set">アポ獲得</option>
                <option value="failed">失敗</option>
                <option value="archived">アーカイブ</option>
              </select>
            </div>

            {/* Result Count */}
            <span className="text-sm text-slate-500 ml-auto">
              {filteredHistories.length}件 / {histories.length}件
            </span>
          </div>

          {/* Row 2: Keyword Search */}
          <div className="flex items-center gap-2">
            <label htmlFor="search-keyword" className="text-sm font-medium text-slate-700 whitespace-nowrap">
              検索:
            </label>
            <div className="relative flex-1 max-w-md">
              <input
                id="search-keyword"
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="会社名・宛名で検索..."
                className="w-full px-4 py-2 pl-10 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Active Jobs Section - Progress Bar */}
          {activeJobs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                実行中の生成タスク
              </h2>
              <div className="grid gap-4">
                {activeJobs.map((job) => {
                  const progress = Math.round(((job.processedCount + job.failureCount) / job.totalCount) * 100) || 0;
                  const isFailed = job.status === 'error'; // User schema uses 'error' for failure status

                  return (
                    <div key={job.id} className={`rounded-xl shadow-sm border p-6 relative overflow-hidden ${isFailed ? 'bg-red-50 border-red-200' : 'bg-white border-indigo-100'
                      }`}>
                      {/* Background highlight */}
                      <div
                        className={`absolute top-0 left-0 h-1 transition-all duration-500 ${isFailed ? 'bg-red-500' : 'bg-indigo-600'}`}
                        style={{ width: `${progress}%` }}
                      />

                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {isFailed ? (
                              <>
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <h3 className="font-bold text-red-700">生成に失敗しました</h3>
                              </>
                            ) : (
                              <h3 className="font-bold text-slate-900">一括生成を実行中...</h3>
                            )}
                            <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">ID: {job.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm text-slate-500">
                            {job.processedCount} / {job.totalCount} 件完了 ({job.failureCount}件失敗)
                          </p>
                          {isFailed && job.errorMessage && (
                            <p className="text-sm text-red-600 mt-1 font-medium bg-red-100 px-2 py-1 rounded">
                              エラー: {job.errorMessage}
                            </p>
                          )}
                        </div>
                        {!isFailed && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            中断
                          </button>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ease-out ${isFailed ? 'bg-red-500' : 'bg-indigo-600'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{progress}% 完了</span>
                        <span>開始: {new Date(job.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                          {/* Format Badge */}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${history.emailContent
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                            {history.emailContent ? 'メール' : '手紙'}
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
        </div>
      )}
    </div>
  );
}
