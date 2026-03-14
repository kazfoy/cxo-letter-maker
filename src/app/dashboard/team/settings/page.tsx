'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { getErrorMessage } from '@/lib/errorUtils';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Building2, Rocket } from 'lucide-react';
import { devLog } from '@/lib/logger';

export default function TeamSettingsPage() {
  const { user } = useAuth();
  const { teamId, teamName, plan, isTeamPlan, loading: planLoading } = useUserPlan();

  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (teamName) {
      setEditName(teamName);
    }
  }, [teamName]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !teamId) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'チーム名の更新に失敗しました');
      }

      setMessage({ type: 'success', text: 'チーム名を更新しました' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'ポータルセッションの作成に失敗しました');
      }
    } catch (err) {
      devLog.error('Portal error:', err);
      setMessage({ type: 'error', text: 'カスタマーポータルの起動に失敗しました: ' + getErrorMessage(err) });
    } finally {
      setPortalLoading(false);
    }
  };

  if (planLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
        <p className="text-slate-600">読み込み中...</p>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">チームに所属していません</p>
        <Link
          href="/dashboard/team"
          className="text-amber-700 hover:text-amber-800 font-medium underline"
        >
          チーム管理に戻る
        </Link>
      </div>
    );
  }

  const planDisplayName = (() => {
    switch (plan) {
      case 'business':
        return 'Business Plan';
      case 'team':
        return 'Team Plan';
      case 'premium':
        return 'Premium Plan';
      case 'pro':
        return 'Pro Plan';
      default:
        return 'Free Plan';
    }
  })();

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard/team"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          チーム管理に戻る
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">チーム設定</h1>
        <p className="text-slate-600">チームの基本情報とプランを管理します</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Team Name */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-700" />
            チーム情報
          </h2>

          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label htmlFor="team_name" className="block text-sm font-medium text-slate-700 mb-2">
                チーム名
              </label>
              <input
                id="team_name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="チーム名を入力"
                required
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !editName.trim() || editName === teamName}
              className="bg-amber-800 text-white py-3 px-6 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : 'チーム名を更新'}
            </button>
          </form>
        </div>

        {/* Plan & Billing */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-700" />
            プラン・お支払い
          </h2>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">現在のプラン</p>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    isTeamPlan ? 'text-amber-700' : 'text-slate-700'
                  }`}
                >
                  {planDisplayName}
                </span>
                {isTeamPlan && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {isTeamPlan ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {portalLoading ? '準備中...' : 'お支払い管理'}
              </button>
            ) : (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white font-bold py-2.5 px-5 rounded-lg shadow transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Rocket className="w-4 h-4" />
                {portalLoading ? '準備中...' : 'プランをアップグレード'}
              </button>
            )}
          </div>

          {!isTeamPlan && (
            <p className="text-xs text-slate-500 mt-3">
              チームプランにアップグレードして、チーム全体でプレミアム機能を利用できます。
            </p>
          )}

          <p className="text-xs text-slate-400 mt-3">
            プランの変更・解約・請求情報の確認はStripeポータルから行えます。
          </p>
        </div>
      </div>
    </div>
  );
}
