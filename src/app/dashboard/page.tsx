'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getHistories } from '@/lib/supabaseHistoryUtils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LetterHistory } from '@/types/letter';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useCheckout } from '@/hooks/useCheckout';
import { Upload, Zap } from 'lucide-react';
import { PlanSelectionModal } from '@/components/PlanSelectionModal';
import { devLog } from '@/lib/logger';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { isPremium, loading: planLoading } = useUserPlan();
  useCheckout(); // Hook for potential future upgrade functionality
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
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
      devLog.error('Failed to load data:', error);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* New Letter CTA */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-800 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-3">新しい手紙を作成</h2>
          <p className="text-amber-100 mb-6">AIが効果的な営業手紙を作成します</p>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 bg-white text-amber-700 px-6 py-3 rounded-md hover:bg-amber-50 transition-colors font-semibold shadow-md"
          >
            <span className="text-xl">✨</span>
            <span>手紙を作成する</span>
          </Link>
        </div>

        {/* Bulk Generate CTA */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-900 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-3">CSV一括生成</h2>
          <p className="text-amber-100 mb-6">CSVファイルから複数の手紙を一度に作成</p>
          <Link
            href="/bulk"
            className="inline-flex items-center gap-2 bg-white text-amber-700 px-6 py-3 rounded-md hover:bg-amber-50 transition-colors font-semibold shadow-md"
          >
            <Upload className="w-5 h-5" />
            <span>一括生成する</span>
          </Link>
        </div>
      </div>

      {/* Upgrade CTA */}
      {!planLoading && (
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl shadow-xl p-8 mb-8 border border-white/10 relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-3xl -mr-32 -mt-32 rounded-full" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 blur-3xl -ml-32 -mb-32 rounded-full" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-4">
                <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                UPGRADE YOUR PLAN
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">プランをアップグレードして制限を解除</h2>
              <p className="text-amber-100/80 mb-6 text-lg">大量生成、優先サポート、高度な機能を今すぐ始めましょう</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto lg:mx-0">
                <div className="flex items-start gap-2 text-amber-100/70 text-sm">
                  <div className="mt-1 bg-white/10 rounded-full p-0.5">
                    <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>1回のリクエストで最大1,000件生成</span>
                </div>
                <div className="flex items-start gap-2 text-amber-100/70 text-sm">
                  <div className="mt-1 bg-white/10 rounded-full p-0.5">
                    <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>業界最先端のAIによる高度な生成</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto text">
              {isPremium ? (
                <div className="px-8 py-4 bg-white/10 text-white rounded-xl font-bold border border-white/20">
                  Premiumプランをご利用中
                </div>
              ) : (
                <button
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-xl hover:bg-slate-100 transition-all font-bold shadow-lg text-lg group"
                >
                  <Zap className="w-5 h-5 text-amber-700" />
                  プランをアップグレード
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">最近の履歴</h2>
          <Link
            href="/dashboard/history"
            className="text-sm text-amber-700 hover:text-amber-800 font-medium"
          >
            すべて見る →
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700 mx-auto mb-2"></div>
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${history.status === 'meeting_set' ? 'bg-green-100 text-green-700' :
                    history.status === 'replied' ? 'bg-orange-100 text-orange-700' :
                      history.status === 'sent' ? 'bg-amber-100 text-amber-700' :
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

      <PlanSelectionModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
