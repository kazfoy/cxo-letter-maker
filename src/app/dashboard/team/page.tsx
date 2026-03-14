'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { getErrorMessage } from '@/lib/errorUtils';
import Link from 'next/link';
import {
  Users,
  Mail,
  UserPlus,
  Crown,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Plus,
} from 'lucide-react';

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

interface TeamInfo {
  id: string;
  name: string;
  plan: string;
  member_count: number;
}

export default function TeamDashboardPage() {
  const { user } = useAuth();
  const { teamId, teamName, loading: planLoading } = useUserPlan();

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);

  const currentUserRole = members.find((m) => m.userId === user?.id)?.role;
  const isAdmin = currentUserRole === 'admin';

  const fetchTeamData = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [teamRes, membersRes, invitesRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/teams/members'),
        fetch('/api/teams/invite'),
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData.team);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvitations(invitesData.invitations || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!planLoading) {
      fetchTeamData();
    }
  }, [planLoading, fetchTeamData]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'チームの作成に失敗しました');
      }

      // Reload page to reflect new team
      window.location.reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteMessage(null);

    try {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '招待の送信に失敗しました');
      }

      setInviteMessage({ type: 'success', text: `${inviteEmail} に招待メールを送信しました` });
      setInviteEmail('');
      fetchTeamData();
    } catch (err) {
      setInviteMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm('このメンバーをチームから削除してもよろしいですか？')) return;

    setRemovingId(memberUserId);

    try {
      const res = await fetch('/api/teams/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberUserId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'メンバーの削除に失敗しました');
      }

      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading || planLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
        <p className="text-slate-600">読み込み中...</p>
      </div>
    );
  }

  // No team - show create CTA
  if (!teamId) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">チーム管理</h1>
          <p className="text-slate-600">チームを作成して、メンバーと一緒に利用しましょう</p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">チームに所属していません</h2>
            <p className="text-slate-600 mb-6">
              チームを作成すると、メンバーを招待してプランを共有できます。
            </p>

            {showCreateForm ? (
              <form onSubmit={handleCreateTeam} className="space-y-4 text-left">
                <div>
                  <label htmlFor="team_name" className="block text-sm font-medium text-slate-700 mb-2">
                    チーム名
                  </label>
                  <input
                    id="team_name"
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="例: 営業チーム"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creating || !newTeamName.trim()}
                    className="flex-1 bg-amber-800 text-white py-3 px-4 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? '作成中...' : 'チームを作成'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTeamName('');
                      setError(null);
                    }}
                    className="px-4 py-3 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 bg-amber-800 text-white py-3 px-6 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm"
              >
                <Plus className="w-5 h-5" />
                チームを作成する
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Has team - show dashboard
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">チーム管理</h1>
          <p className="text-slate-600">{teamName || team?.name} のメンバーと招待を管理します</p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/team/settings"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            チーム設定
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8 max-w-3xl">
        {/* Invite Member */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-700" />
              メンバーを招待
            </h2>

            <form onSubmit={handleInvite} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="メールアドレスを入力"
                  required
                />
                <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="bg-amber-800 text-white px-6 py-3 rounded-md hover:bg-amber-900 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {inviting ? '送信中...' : '招待する'}
              </button>
            </form>

            {inviteMessage && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${
                  inviteMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {inviteMessage.text}
              </div>
            )}
          </div>
        )}

        {/* Member List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-700" />
            メンバー一覧
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({members.length}名)
            </span>
          </h2>

          {members.length === 0 ? (
            <p className="text-slate-500 text-sm">メンバーがいません</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-600 font-medium text-sm">
                        {(member.name || member.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {member.name || member.email}
                      </p>
                      {member.name && (
                        <p className="text-xs text-slate-500">{member.email}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                        member.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {member.role === 'admin' && <Crown className="w-3 h-3" />}
                      {member.role === 'admin' ? '管理者' : 'メンバー'}
                    </span>
                  </div>

                  {isAdmin && member.userId !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={removingId === member.userId}
                      className="text-slate-400 hover:text-red-500 transition-colors p-2 disabled:opacity-50"
                      title="メンバーを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-700" />
              招待中
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({invitations.length}件)
              </span>
            </h2>

            <ul className="divide-y divide-slate-100">
              {invitations.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(invite.created_at).toLocaleDateString('ja-JP')} に招待
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                      invite.status === 'pending'
                        ? 'bg-yellow-50 text-yellow-700'
                        : invite.status === 'accepted'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {invite.status === 'pending' && <Clock className="w-3 h-3" />}
                    {invite.status === 'accepted' && <CheckCircle className="w-3 h-3" />}
                    {invite.status === 'expired' && <XCircle className="w-3 h-3" />}
                    {invite.status === 'pending'
                      ? '承認待ち'
                      : invite.status === 'accepted'
                      ? '承認済み'
                      : '期限切れ'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
