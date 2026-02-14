'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getHistories } from '@/lib/supabaseHistoryUtils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LetterHistory } from '@/types/letter';
import { useUserPlan } from '@/hooks/useUserPlan';
import { PlanSelectionModal } from '@/components/PlanSelectionModal';
import {
  FileText,
  Upload,
  ArrowRight,
  Calendar,
  Target,
  MessageSquare,
  Sparkles,
  X,
  ChevronRight,
  Clock
} from 'lucide-react';
import { devLog } from '@/lib/logger';

export default function DashboardPreviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { isPro, isPremium, loading: planLoading } = useUserPlan();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(true);
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

  // Calculate metrics
  const totalCount = histories.length;
  const thisMonthCount = histories.filter(h => {
    const created = new Date(h.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const meetingSetCount = histories.filter(h => h.status === 'meeting_set').length;
  const repliedCount = histories.filter(h => h.status === 'replied').length;

  // Get user's first name or email prefix for greeting
  const userName = user?.email?.split('@')[0] || 'ユーザー';

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'おはようございます';
    if (hour < 18) return 'こんにちは';
    return 'こんばんは';
  };

  const statusConfig = {
    meeting_set: { label: 'アポ獲得', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    replied: { label: '返信あり', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    sent: { label: '送付済', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    draft: { label: '作成済', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  } as const;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          {/* Greeting */}
          <div>
            <p className="text-sm font-medium text-slate-500 tracking-wide mb-1">
              {getGreeting()}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {userName}さん
            </h1>
          </div>

          {/* Summary Metrics */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-slate-600">今月</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {thisMonthCount}
              </span>
              <span className="text-slate-500">通</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600">アポ獲得</span>
              <span className="font-mono font-semibold text-emerald-600 tabular-nums">
                {meetingSetCount}
              </span>
              <span className="text-slate-500">件</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          クイックアクション
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* New Letter Card */}
          <Link
            href="/new"
            className="group relative bg-white border border-slate-200 rounded-lg p-6 hover:border-indigo-300 hover:shadow-sm transition-all duration-150"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  1通ずつ作成
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  送付先の情報を入力して、AIが最適な営業手紙を生成します
                </p>
              </div>
            </div>
          </Link>

          {/* Bulk Generate Card */}
          <Link
            href="/bulk"
            className="group relative bg-white border border-slate-200 rounded-lg p-6 hover:border-purple-300 hover:shadow-sm transition-all duration-150"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Upload className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  一括生成
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  CSVファイルから複数の手紙を一度に生成できます
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          実績サマリー
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Letters */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">総作成数</span>
            </div>
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums tracking-tight">
              {totalCount}
            </p>
          </div>

          {/* This Month */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">今月の作成</span>
            </div>
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums tracking-tight">
              {thisMonthCount}
            </p>
          </div>

          {/* Meeting Set */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500">アポ獲得</span>
            </div>
            <p className="text-2xl font-semibold text-emerald-600 font-mono tabular-nums tracking-tight">
              {meetingSetCount}
            </p>
          </div>

          {/* Replied */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-500">返信あり</span>
            </div>
            <p className="text-2xl font-semibold text-amber-600 font-mono tabular-nums tracking-tight">
              {repliedCount}
            </p>
          </div>
        </div>
      </section>

      {/* Upgrade Banner (Free plan only) */}
      {!planLoading && !isPro && !isPremium && showUpgradeBanner && (
        <section className="relative bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-6 overflow-hidden">
          {/* Subtle decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8" />

          <button
            onClick={() => setShowUpgradeBanner(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-300 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  Pro プラン
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                より多くの手紙を生成しませんか？
              </h3>
              <p className="text-sm text-slate-400">
                月間100通まで生成可能。優先サポート付き。
              </p>
            </div>
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 rounded-md font-medium text-sm hover:bg-slate-100 transition-colors"
            >
              プランを見る
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Recent History */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            最近の履歴
          </h2>
          <Link
            href="/dashboard/history"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
          >
            すべて見る
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-sm">読み込み中...</span>
              </div>
            </div>
          ) : histories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">
                まだ履歴がありません
              </p>
              <p className="text-xs text-slate-500 text-center">
                最初の手紙を作成してみましょう
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {histories.slice(0, 5).map((history) => {
                const status = statusConfig[history.status as keyof typeof statusConfig] || statusConfig.draft;
                return (
                  <div
                    key={history.id}
                    onClick={() => router.push(`/new?restore=${history.id}`)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-sm font-medium text-slate-900 truncate">
                          {history.targetCompany}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {history.targetName}様
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        <time className="font-mono tabular-nums">
                          {new Date(history.createdAt).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <PlanSelectionModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
