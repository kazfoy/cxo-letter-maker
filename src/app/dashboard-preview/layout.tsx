'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Home, PencilLine, Upload, Clock, Settings, HelpCircle, Eye } from 'lucide-react';
import { EXTERNAL_LINKS } from '@/lib/constants';

export default function DashboardPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    { href: '/dashboard-preview', label: 'ダッシュボード', icon: Home },
    { href: '/new', label: '新規作成', icon: PencilLine },
    { href: '/bulk', label: '一括作成', icon: Upload },
    { href: '/dashboard/history', label: '履歴', icon: Clock },
    { href: '/dashboard/settings', label: '設定', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo/Title */}
        <div className="p-6 border-b border-slate-200">
          <Link href="/dashboard-preview">
            <h1 className="text-xl font-bold text-slate-900">CxO Letter Maker</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">マイページ</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                <Eye className="w-3 h-3" />
                Preview
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col">
          <ul className="space-y-1 flex-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Support Link */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <a
              href={EXTERNAL_LINKS.support}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>お問い合わせ</span>
            </a>
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-200">
          <div className="mb-3">
            <p className="text-xs text-slate-400 mb-0.5">ログイン中</p>
            <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-md transition-colors text-sm font-medium border border-slate-200"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-8 py-8 max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
