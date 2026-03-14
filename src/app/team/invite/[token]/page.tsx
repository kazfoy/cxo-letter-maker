'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { getErrorMessage } from '@/lib/errorUtils';
import { Users, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface InvitationInfo {
  team_name: string;
  inviter_email: string;
  inviter_name: string | null;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchInvitation = async () => {
      try {
        const res = await fetch(`/api/teams/invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '招待情報の取得に失敗しました');
        }

        setInvitation(data.invitation || data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/team/invite/${token}`)}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '招待の承認に失敗しました');
      }

      setAccepted(true);

      setTimeout(() => {
        router.push('/dashboard/team');
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAccepting(false);
    }
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      );
    }

    if (error && !invitation) {
      return (
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">招待を読み込めません</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link
              href="/"
              className="text-amber-700 hover:text-amber-800 font-medium underline"
            >
              トップページに戻る
            </Link>
          </div>
        </div>
      );
    }

    if (!invitation) return null;

    // Already accepted
    if (invitation.status === 'accepted') {
      return (
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">承認済みの招待です</h2>
            <p className="text-slate-600 mb-6">
              この招待は既に承認されています。
            </p>
            <Link
              href="/dashboard/team"
              className="inline-flex items-center gap-2 bg-amber-800 text-white py-3 px-6 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm"
            >
              チームダッシュボードへ
            </Link>
          </div>
        </div>
      );
    }

    // Expired
    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
      return (
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">招待の有効期限が切れています</h2>
            <p className="text-slate-600 mb-6">
              この招待リンクは有効期限が切れています。チーム管理者に新しい招待を依頼してください。
            </p>
            <Link
              href="/"
              className="text-amber-700 hover:text-amber-800 font-medium underline"
            >
              トップページに戻る
            </Link>
          </div>
        </div>
      );
    }

    // Just accepted
    if (accepted) {
      return (
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">チームに参加しました</h2>
            <p className="text-slate-600 mb-2">
              <span className="font-medium">{invitation.team_name}</span> に参加しました。
            </p>
            <p className="text-sm text-slate-500">チームダッシュボードに移動します...</p>
          </div>
        </div>
      );
    }

    // Pending - show accept form
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">チームへの招待</h2>
          <p className="text-slate-600 mb-6">
            <span className="font-medium text-slate-900">{invitation.team_name}</span> への参加招待が届いています
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">チーム名</span>
                <span className="text-sm font-medium text-slate-900">{invitation.team_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">招待者</span>
                <span className="text-sm font-medium text-slate-900">
                  {invitation.inviter_name || invitation.inviter_email}
                </span>
              </div>
              {invitation.inviter_name && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">メール</span>
                  <span className="text-xs text-slate-500">{invitation.inviter_email}</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {!user && (
            <p className="text-sm text-slate-500 mb-4">
              招待を承認するにはログインが必要です。
            </p>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-800 text-white py-3 px-6 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                承認中...
              </>
            ) : !user ? (
              'ログインして招待を承認'
            ) : (
              '招待を承認する'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {renderContent()}
      </div>
    </div>
  );
}
