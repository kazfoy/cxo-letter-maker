'use client';

import { useEffect, useState } from 'react';
import { getProfile, updateProfile, type Profile } from '@/lib/profileUtils';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    company_name: '',
    user_name: '',
    service_description: '',
    company_url: '',
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
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      console.error('Save error:', error);
      setMessage({
        type: 'error',
        text: error.message || '保存に失敗しました',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <p className="text-slate-600">デフォルトの差出人情報を設定します</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl">
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
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  );
}
