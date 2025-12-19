'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      console.log('User already logged in, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setAwaitingConfirmation(false);

    try {
      console.log('Starting signup process...');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Signup error:', error);
        throw error;
      }

      console.log('Signup response:', { hasUser: !!data.user, hasSession: !!data.session });

      // ケースA: 即時ログイン成功（メール確認不要）
      if (data.session) {
        console.log('Session exists - redirecting to dashboard');
        setMessage({
          type: 'success',
          text: 'アカウントを作成しました。ダッシュボードに移動します...',
        });
        // 少し待ってからリダイレクト（メッセージを見せるため）
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      }
      // ケースB: メール確認待ち
      else if (data.user && !data.session) {
        console.log('Email confirmation required - showing confirmation message');
        setAwaitingConfirmation(true);
        setMessage({
          type: 'success',
          text: '確認メールを送信しました',
        });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'アカウント作成に失敗しました。もう一度お試しください。',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      console.log('Starting signin process...');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Signin error:', error);
        throw error;
      }

      console.log('Signin successful, redirecting to dashboard');
      setMessage({
        type: 'success',
        text: 'ログインしました。ダッシュボードに移動します...',
      });

      // 少し待ってからリダイレクト
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (error: any) {
      console.error('Signin error:', error);
      let errorMessage = 'ログインに失敗しました';

      // Provide more specific error messages
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。確認メールをご確認ください';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessage({
        type: 'error',
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isSignUp) {
      handleSignUp(e);
    } else {
      handleSignIn(e);
    }
  };

  // メール確認待ち画面
  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">📧</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-4">
                確認メールを送信しました
              </h1>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <p className="text-sm text-blue-900 mb-3">
                  <strong>{email}</strong> 宛に確認メールを送信しました。
                </p>
                <p className="text-sm text-blue-800 mb-2">
                  メール内のリンクをクリックして登録を完了してください。
                </p>
                <p className="text-xs text-blue-700">
                  メールが届かない場合は、迷惑メールフォルダをご確認ください。
                </p>
              </div>
              <button
                onClick={() => {
                  setAwaitingConfirmation(false);
                  setIsSignUp(false);
                  setEmail('');
                  setPassword('');
                  setMessage(null);
                }}
                className="w-full bg-slate-100 text-slate-700 py-3 px-4 rounded-md hover:bg-slate-200 transition-all font-medium"
              >
                ログイン画面に戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {isSignUp ? '新規登録' : 'ログイン'}
            </h1>
            <p className="text-slate-600">
              CxO Letter Maker
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

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
              {isSignUp && (
                <p className="mt-1 text-xs text-slate-500">
                  6文字以上で入力してください
                </p>
              )}
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
              {loading ? '処理中...' : isSignUp ? 'アカウントを作成' : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {isSignUp ? 'すでにアカウントをお持ちですか？ ログイン' : 'アカウントをお持ちでない方は 新規登録'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← ホームに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
