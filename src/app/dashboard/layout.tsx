'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Home, PencilLine, Upload, Clock, Settings, HelpCircle } from 'lucide-react';
import { EXTERNAL_LINKS } from '@/lib/constants';

export default function DashboardLayout({
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: Home },
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
          <Link href="/dashboard">
            <h1 className="text-xl font-bold text-slate-900">CxO Letter Maker</h1>
            <p className="text-xs text-slate-500 mt-1">マイページ</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col">
          <ul className="space-y-2 flex-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Support Link */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <a
              href={EXTERNAL_LINKS.support}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-md text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
              <span>お問い合わせ</span>
            </a>
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-200">
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1">ログイン中</p>
            <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md transition-colors text-sm font-medium"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
