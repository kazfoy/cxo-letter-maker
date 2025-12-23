'use client';
import { getErrorMessage } from '@/lib/errorUtils';


import { useEffect, useState } from 'react';
import { getProfile, updateProfile, type Profile } from '@/lib/profileUtils';
import { createClient } from '@/utils/supabase/client';
import { Upload, FileText, Trash2, Lock, CreditCard, Rocket, HelpCircle } from 'lucide-react';
import { updatePassword } from './actions';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { EXTERNAL_LINKS } from '@/lib/constants';

function SecuritySettings() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で入力してください' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await updatePassword(newPassword);

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'パスワードを更新しました' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">セキュリティ設定</h3>
      <p className="text-sm text-slate-600 mb-4">
        ログイン用のパスワードを変更します
      </p>

      <div className="space-y-4 max-w-md">
        <div>
          <label htmlFor="new_password" className="block text-sm font-medium text-slate-700 mb-2">
            新しいパスワード
          </label>
          <div className="relative">
            <input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
          </div>
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-2">
            新しいパスワード（確認）
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md text-sm ${message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
              }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="button"
          onClick={handlePasswordUpdate}
          disabled={loading || !newPassword}
          className="bg-white text-slate-700 border border-slate-300 py-2 px-4 rounded-md hover:bg-slate-50 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {loading ? '更新中...' : 'パスワードを変更'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { isPro, loading: planLoading } = useUserPlan();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    user_name: '',
    service_description: '',
    company_url: '',
    reference_docs: [] as { name: string; path: string }[],
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      if (data) {
        setProfile(data);
        setFormData({
          company_name: data.company_name || '',
          user_name: data.user_name || '',
          service_description: data.service_description || '',
          company_url: data.company_url || '',
          reference_docs: data.reference_docs || [],
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('決済ページの作成に失敗しました');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('決済処理中にエラーが発生しました');
    } finally {
      setUpgrading(false);
    }
  };

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'ポータルセッションの作成に失敗しました');
      }
    } catch (error: unknown) {
      console.error('Portal error:', error);
      alert('カスタマーポータルの起動に失敗しました: ' + getErrorMessage(error));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile?.id) return;

    if (formData.reference_docs.length + e.target.files.length > 3) {
      alert('アップロードできるファイルは最大3つまでです。');
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const newDocs = [...formData.reference_docs];

    for (const file of Array.from(e.target.files)) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`ファイル ${file.name} は10MBを超えています。`);
        continue;
      }
      if (file.type !== 'application/pdf') {
        alert(`ファイル ${file.name} はPDFではありません。`);
        continue;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${crypto.randomUUID()}.${fileExt}`;

      try {
        const { error } = await supabase.storage
          .from('user_assets')
          .upload(fileName, file);

        if (error) throw error;

        newDocs.push({
          name: file.name,
          path: fileName,
        });
      } catch (err) {
        console.error('Upload failed:', err);
        alert(`アップロードに失敗しました: ${file.name}`);
      }
    }

    setFormData(prev => ({ ...prev, reference_docs: newDocs }));
    setUploading(false);
    e.target.value = '';
  };

  const handleDeleteFile = async (path: string) => {
    if (!confirm('このファイルを削除してもよろしいですか？（保存ボタンを押すと確定します）')) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from('user_assets')
        .remove([path]);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        reference_docs: prev.reference_docs.filter(doc => doc.path !== path)
      }));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('ファイルの削除に失敗しました。');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await updateProfile(formData);
      if (updated) {
        setProfile(updated);
        setMessage({
          type: 'success',
          text: 'プロフィールを保存しました',
        });
      } else {
        throw new Error('保存に失敗しました');
      }
    } catch (error: unknown) {
      console.error('Save error:', error);
      setMessage({
        type: 'error',
        text: getErrorMessage(error) || '保存に失敗しました',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || planLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-600">読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">設定</h1>
        <p className="text-slate-600">プロファイル編集、プラン管理、セキュリティ設定</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Plan Management Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            プラン管理
          </h2>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">現在のプラン</p>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${isPro ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </span>
                {isPro && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {!isPro ? (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2.5 px-5 rounded-lg shadow transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Rocket className="w-4 h-4" />
                {upgrading ? '準備中...' : 'Proにアップグレード'}
              </button>
            ) : (
              <button
                onClick={handlePortal}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                プランの管理・解約
              </button>
            )}
          </div>
          {!isPro && (
            <p className="text-xs text-slate-500 mt-3">
              Proプランでは、無制限の生成、Wordダウンロード、高度な履歴管理が利用可能です。
            </p>
          )}
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">デフォルトの差出人情報</h2>
            <p className="text-sm text-slate-600">
              ここで設定した情報は、手紙作成画面で自動的に入力されます
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-slate-700 mb-2">
                自社名
              </label>
              <input
                id="company_name"
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="株式会社〇〇"
              />
            </div>

            <div>
              <label htmlFor="user_name" className="block text-sm font-medium text-slate-700 mb-2">
                氏名
              </label>
              <input
                id="user_name"
                type="text"
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="山田 太郎"
              />
            </div>

            <div>
              <label htmlFor="service_description" className="block text-sm font-medium text-slate-700 mb-2">
                自社サービス概要
              </label>
              <textarea
                id="service_description"
                value={formData.service_description}
                onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                placeholder="弊社は〇〇を提供しています..."
              />
            </div>

            <div>
              <label htmlFor="company_url" className="block text-sm font-medium text-slate-700 mb-2">
                自社URL
              </label>
              <input
                id="company_url"
                type="url"
                value={formData.company_url}
                onChange={(e) => setFormData({ ...formData, company_url: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com"
              />
            </div>

            <hr className="my-8 border-slate-200" />

            <div className="space-y-6">
              <SecuritySettings />
            </div>

            <hr className="my-8 border-slate-200" />

            {/* Reference Documents */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">参照資料 (PDFのみ)</h3>
              <p className="text-sm text-slate-600 mb-4">
                会社案内や製品資料などのPDFをアップロードすると、AIがその内容を参照してより精度の高い手紙を作成します。<br />
                ※最大3ファイル、各10MBまで
              </p>

              <div className="space-y-4">
                {formData.reference_docs.length < 3 && (
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 ${uploading ? 'opacity-50 cursor-not-allowed' : 'border-slate-300'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-slate-500" />
                        <p className="text-sm text-slate-500"><span className="font-semibold">クリックしてアップロード</span></p>
                        <p className="text-xs text-slate-500">PDF (MAX. 10MB)</p>
                      </div>
                      <input
                        id="dropzone-file"
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                )}

                {uploading && <p className="text-sm text-blue-600 text-center">処理中...</p>}

                {/* File List */}
                {formData.reference_docs.length > 0 && (
                  <ul className="space-y-2">
                    {formData.reference_docs.map((doc, index) => (
                      <li key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">{doc.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(doc.path)}
                          disabled={uploading}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <hr className="my-8 border-slate-200" />

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
              disabled={saving || uploading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存して適用'}
            </button>
          </form>
        </div>

        {/* Support Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            サポート
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            ご不明な点やお困りのことがございましたら、お気軽にお問い合わせください。
          </p>
          <a
            href={EXTERNAL_LINKS.support}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-sm font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            お問い合わせフォームを開く
          </a>
        </div>
      </div>
    </div>
  );
}
