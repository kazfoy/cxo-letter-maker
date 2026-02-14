'use client';
import { getErrorMessage } from '@/lib/errorUtils';


import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { devLog } from '@/lib/logger';

type TabType = 'login' | 'signup';
type AuthMethod = 'magic_link' | 'otp_code';

function LoginContent() {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  // OTP (6桁コード) 関連の状態
  const [authMethod, setAuthMethod] = useState<AuthMethod>('magic_link');
  const [otpCode, setOtpCode] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  const authError = searchParams.get('error');
  const supabase = createClient();

  // Redirect logged-in users
  useEffect(() => {
    if (user) {
      devLog.log('User already logged in, redirecting');
      router.push(redirectPath);
    }
  }, [user, router, redirectPath]);

  // Handle auth errors from callback
  useEffect(() => {
    if (authError) {
      let errorMessage = 'ログインに失敗しました';
      if (authError.includes('expired') || authError === 'otp_expired') {
        errorMessage = 'リンクの有効期限が切れています。6桁コードでログインするか、リンクを再送信してください。';
        setAuthMethod('otp_code');
      } else if (authError.includes('pkce') || authError === 'pkce_not_found') {
        errorMessage = 'セッションエラーが発生しました。6桁コードでログインしてください。';
        setAuthMethod('otp_code');
      } else if (authError === 'missing_code') {
        errorMessage = '認証コードが見つかりません。再度お試しください。';
      }
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [authError]);

  // 新規登録: Magic Link (OTP) を送信
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMagicLinkSent(false);

    try {


      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // emailRedirectToは/auth/callbackのみを指定
          // コールバック側でパスワード未設定を判定して/setup-passwordにリダイレクト
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        devLog.error('Magic link error:', error);
        throw error;
      }

      devLog.log('Magic link sent successfully');
      setMagicLinkSent(true);
      setMessage({
        type: 'success',
        text: '登録用リンクを送信しました',
      });
    } catch (error: unknown) {
      devLog.error('Signup error:', error);
      setMessage({
        type: 'error',
        text: getErrorMessage(error) || '登録リンクの送信に失敗しました。もう一度お試しください。',
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
      devLog.log('Starting signin process...');

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        devLog.error('Signin error:', error);
        throw error;
      }

      devLog.log('Signin successful, redirecting');
      setMessage({
        type: 'success',
        text: 'ログインしました。移動します...',
      });

      // 少し待ってからリダイレクト
      setTimeout(() => {
        router.push(redirectPath);
      }, 500);
    } catch (error: unknown) {
      devLog.error('Signin error:', error);
      const message = getErrorMessage(error);
      let errorMessage = 'ログインに失敗しました';

      // Provide more specific error messages
      if (message.includes('Invalid login credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません';
      } else if (message.includes('Email not confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。登録用リンクから登録を完了してください';
      } else if (message) {
        errorMessage = message;
      }

      setMessage({
        type: 'error',
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // OTP (6桁コード) で認証
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      devLog.log('Verifying OTP code...');

      // まず type: 'email' で試す
      let result = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      // 失敗した場合は type: 'signup' で再試行
      if (result.error) {
        devLog.log('Trying with type: signup...');
        result = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'signup',
        });
      }

      if (result.error) {
        devLog.error('OTP verification error:', result.error);
        throw result.error;
      }

      devLog.log('OTP verification successful');
      setMessage({
        type: 'success',
        text: '認証成功！移動します...',
      });

      // パスワード設定済みかチェック
      const hasPasswordSet = result.data.user?.user_metadata?.password_set === true;

      setTimeout(() => {
        if (hasPasswordSet) {
          router.push(redirectPath);
        } else {
          router.push('/setup-password');
        }
      }, 500);
    } catch (error: unknown) {
      devLog.error('OTP error:', error);
      const errorMsg = getErrorMessage(error);
      let displayMessage = 'コードの検証に失敗しました';

      if (errorMsg.includes('expired')) {
        displayMessage = 'コードの有効期限が切れています。新しいリンクを送信してください。';
      } else if (errorMsg.includes('invalid')) {
        displayMessage = 'コードが正しくありません。再度入力してください。';
      } else if (errorMsg) {
        displayMessage = errorMsg;
      }

      setMessage({
        type: 'error',
        text: displayMessage,
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

              {/* 認証方法切り替えタブ */}
              <div className="flex border-b border-slate-200 mb-4">
                <button
                  type="button"
                  onClick={() => setAuthMethod('magic_link')}
                  className={`flex-1 py-2 px-3 text-sm font-medium border-b-2 transition-colors ${authMethod === 'magic_link'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  メールリンク
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('otp_code')}
                  className={`flex-1 py-2 px-3 text-sm font-medium border-b-2 transition-colors ${authMethod === 'otp_code'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  6桁コード
                </button>
              </div>

              {/* メールリンク方式 */}
              {authMethod === 'magic_link' && (
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
                  <p className="text-xs text-slate-600 mt-3">
                    リンクが開けない場合は「6桁コード」タブをお試しください
                  </p>
                </div>
              )}

              {/* 6桁コード方式 */}
              {authMethod === 'otp_code' && (
                <form onSubmit={handleVerifyOtp} className="text-left mb-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-800">
                      📱 メールアプリ内でリンクが開けない場合は、メールに記載された6桁のコードを入力してください。
                    </p>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="otp-code" className="block text-sm font-medium text-slate-700 mb-2">
                      6桁コード
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-center text-2xl tracking-widest font-mono text-slate-900"
                      placeholder="000000"
                      disabled={loading}
                    />
                  </div>

                  {message && (
                    <div
                      className={`p-4 rounded-md mb-4 ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                        }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '確認中...' : 'コードを確認'}
                  </button>
                </form>
              )}

              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setActiveTab('login');
                  setEmail('');
                  setPassword('');
                  setOtpCode('');
                  setMessage(null);
                  setAuthMethod('magic_link');
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
