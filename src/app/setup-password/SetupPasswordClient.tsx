'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

type Props = {
  user: User;
};

export default function SetupPasswordClient({ user }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    console.log('========== SETUP-PASSWORD PAGE MOUNT ==========');
    console.log('User:', user?.email || 'none');
    console.log('User metadata:', user?.user_metadata || {});
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password.length < 6) {
      setMessage({
        type: 'error',
        text: 'パスワードは6文字以上で入力してください',
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'パスワードが一致しません',
      });
      setLoading(false);
      return;
    }

    try {
      console.log('Updating user password...');

      const { error } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true, // パスワード設定済みフラグ
        },
      });

      if (error) {
        console.error('Password update error:', error);
        throw error;
      }

      console.log('Password updated successfully');
      setMessage({
        type: 'success',
        text: 'パスワードを設定しました。ダッシュボードに移動します...',
      });

      // プロフィールを作成（まだ存在しない場合）
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        console.log('Creating profile...');
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
          });
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (error: any) {
      console.error('Setup password error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'パスワードの設定に失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              パスワードを設定
            </h1>
            <p className="text-slate-600 text-sm">
              アカウント登録を完了するため、パスワードを設定してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="••••••••"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-slate-500">
                6文字以上で入力してください
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-2">
                パスワード（確認）
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '設定中...' : 'パスワードを設定して完了'}
            </button>
          </form>

          <div className="mt-4">
            <button
              onClick={() => {
                console.log('Skipping password setup, redirecting to dashboard');
                router.push('/dashboard');
              }}
              disabled={loading}
              className="w-full bg-slate-100 text-slate-700 py-3 px-4 rounded-md hover:bg-slate-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              スキップしてダッシュボードへ
            </button>
            <p className="mt-2 text-xs text-slate-500 text-center">
              パスワードは後から設定できます
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              ログイン中: {user.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


