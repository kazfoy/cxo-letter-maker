'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

type TabType = 'login' | 'signup';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  const supabase = createClient();

  // Redirect logged-in users
  useEffect(() => {
    if (user) {
      console.log('User already logged in, redirecting');
      router.push(redirectPath);
    }
  }, [user, router, redirectPath]);

  // 新規登録: Magic Link (OTP) を送信
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMagicLinkSent(false);

    try {


      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // emailRedirectToは/auth/callbackのみを指定
          // コールバック側でパスワード未設定を判定して/setup-passwordにリダイレクト
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Magic link error:', error);
        throw error;
      }

      console.log('Magic link sent successfully');
      setMagicLinkSent(true);
      setMessage({
        type: 'success',
        text: '登録用リンクを送信しました',
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      setMessage({
        type: 'error',
        text: error.message || '登録リンクの送信に失敗しました。もう一度お試しください。',
      });
    } finally {
      setLoading(false);
    }
  };

  // ログイン: Email + Password
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

      console.log('Signin successful, redirecting');
      setMessage({
        type: 'success',
        text: 'ログインしました。移動します...',
      });

      // 少し待ってからリダイレクト
      setTimeout(() => {
        router.push(redirectPath);
      }, 500);
    } catch (error: any) {
      console.error('Signin error:', error);
      let errorMessage = 'ログインに失敗しました';

      // Provide more specific error messages
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。登録用リンクから登録を完了してください';
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

  // Magic Link送信完了画面
  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="text-center">
              <div className="text-7xl mb-6 animate-bounce">📧</div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">
                メールを確認してください
              </h1>
              <p className="text-lg text-slate-700 mb-6">
                登録用リンクを送信しました
              </p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
                <p className="text-base text-blue-900 mb-4 font-medium">
                  📨 送信先: <strong className="text-indigo-700">{email}</strong>
                </p>
                <div className="bg-white/60 rounded-md p-4 mb-4">
                  <p className="text-sm text-blue-900 font-semibold mb-2">
                    ✨ 次のステップ
                  </p>
                  <ol className="text-sm text-blue-800 space-y-2 text-left">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>メールボックスを確認</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>メール内のリンクをクリック</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>パスワードを設定して登録完了！</span>
                    </li>
                  </ol>
                </div>
                <p className="text-xs text-blue-700">
                  💡 メールが届かない場合は、迷惑メールフォルダもご確認ください
                </p>
              </div>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setActiveTab('login');
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
              CxO Letter Maker
            </h1>
            <p className="text-slate-600">
              セールスレター作成ツール
            </p>
          </div>

          {/* タブUI */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setMessage(null);
                setPassword('');
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'login'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setMessage(null);
                setPassword('');
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'signup'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              新規登録
            </button>
          </div>

          {/* ログインフォーム */}
          {activeTab === 'login' && (
            <form onSubmit={handleSignIn} className="space-y-6">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-2">
                  メールアドレス
                </label>
                <input
                  id="login-email"
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
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-2">
                  パスワード
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              {message && (
                <div
                  className={`p-4 rounded-md ${message.type === 'success'
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
                {loading ? '処理中...' : 'ログイン'}
              </button>
            </form>
          )}

          {/* 新規登録フォーム */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-6">
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-2">
                  メールアドレス
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="your@email.com"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-slate-500">
                  登録用リンクをメールで送信します
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-900">
                  📌 メール内のリンクをクリックすると、パスワード設定画面が開きます。パスワードを設定して登録を完了してください。
                </p>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-md ${message.type === 'success'
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
                {loading ? '送信中...' : '登録用リンクを送信'}
              </button>
            </form>
          )}

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
