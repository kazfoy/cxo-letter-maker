'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getHistories, type LetterHistory } from '@/lib/supabaseHistoryUtils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [histories, setHistories] = useState<LetterHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const data = await getHistories();
      setHistories(data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate KPIs
  const totalCount = histories.length;
  const thisMonthCount = histories.filter(h => {
    const created = new Date(h.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const meetingSetCount = histories.filter(h => h.status === 'meeting_set').length;
  const repliedCount = histories.filter(h => h.status === 'replied').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">ダッシュボード</h1>
        <p className="text-slate-600">営業活動の状況を一目で確認できます</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">総作成数</h3>
            <span className="text-2xl">📝</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
          <p className="text-xs text-slate-500 mt-1">これまでに作成した手紙</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">今月の作成数</h3>
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{thisMonthCount}</p>
          <p className="text-xs text-slate-500 mt-1">今月作成した手紙</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">アポ獲得数</h3>
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{meetingSetCount}</p>
          <p className="text-xs text-slate-500 mt-1">面談が決定した件数</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">返信あり</h3>
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-3xl font-bold text-orange-600">{repliedCount}</p>
          <p className="text-xs text-slate-500 mt-1">返信があった件数</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-white mb-3">新しい手紙を作成</h2>
        <p className="text-indigo-100 mb-6">AIが効果的な営業手紙を作成します</p>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-md hover:bg-indigo-50 transition-colors font-semibold shadow-md"
        >
          <span className="text-xl">✨</span>
          <span>手紙を作成する</span>
        </Link>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">最近の履歴</h2>
          <Link
            href="/dashboard/history"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            すべて見る →
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            <p className="text-sm text-slate-500">読み込み中...</p>
          </div>
        ) : histories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-6xl mb-4">📂</p>
            <p className="text-slate-600 mb-2">まだ履歴がありません</p>
            <p className="text-sm text-slate-500">最初の手紙を作成してみましょう！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {histories.slice(0, 5).map((history) => (
              <div
                key={history.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/new?restore=${history.id}`)}
              >
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{history.targetCompany}</h3>
                  <p className="text-sm text-slate-600">{history.targetName}様</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    history.status === 'meeting_set' ? 'bg-green-100 text-green-700' :
                    history.status === 'replied' ? 'bg-orange-100 text-orange-700' :
                    history.status === 'sent' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {history.status === 'meeting_set' ? 'アポ獲得' :
                     history.status === 'replied' ? '返信あり' :
                     history.status === 'sent' ? '送付済' : '作成済'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(history.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
