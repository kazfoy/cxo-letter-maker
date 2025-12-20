'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Mail, Target, Zap, FileText, Download, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // ログイン済みユーザーは自動的に /dashboard へリダイレクト
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // ログイン済みユーザーの場合は何も表示しない（リダイレクト中）
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/30 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <div className="inline-block">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-800/10 text-amber-800 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  累計生成数 1,000通突破
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-stone-900 leading-tight">
                決裁者へのアポ率を<br />
                <span className="text-amber-800">3倍</span>にする。
              </h1>

              <p className="text-2xl md:text-3xl font-serif text-stone-700 leading-relaxed">
                AIが書く、本気の手紙。
              </p>

              <p className="text-lg text-stone-600 leading-relaxed">
                URLを入れるだけ。才流メソッドに基づいた個別最適化レターを、30秒で。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/new"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-stone-900 text-stone-50 rounded-md font-medium text-lg hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl"
                >
                  今すぐ手紙を書く（無料）
                  <Mail className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-stone-900 border-2 border-stone-200 rounded-md font-medium text-lg hover:bg-stone-50 transition-all"
                >
                  ログイン
                </Link>
              </div>
            </div>

            {/* Right: Visual Mockup */}
            <div className="relative">
              <div className="relative bg-white rounded-lg shadow-2xl border border-stone-200 p-8 rotate-1 hover:rotate-0 transition-transform">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-800/10 rounded-full blur-2xl"></div>
                <div className="space-y-4">
                  <div className="h-3 bg-stone-200 rounded w-3/4"></div>
                  <div className="h-3 bg-stone-200 rounded w-full"></div>
                  <div className="h-3 bg-stone-200 rounded w-5/6"></div>
                  <div className="h-16 bg-stone-100 rounded mt-6"></div>
                  <div className="h-3 bg-stone-200 rounded w-full"></div>
                  <div className="h-3 bg-stone-200 rounded w-4/5"></div>
                  <div className="h-3 bg-stone-200 rounded w-full"></div>
                  <div className="h-3 bg-stone-200 rounded w-3/4"></div>
                </div>
                <div className="absolute bottom-8 right-8">
                  <div className="w-12 h-12 bg-amber-800/20 rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-800" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 -left-8 w-full h-full bg-amber-800/5 rounded-lg -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section id="features" className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left: Problem */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900">
                メールは読まれない。<br />
                手書きは時間がかかる。
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-stone-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">メールは開封されない</h3>
                    <p className="text-stone-600 leading-relaxed">
                      決裁者のメールボックスには1日100通以上のメールが届きます。あなたの提案は読まれていません。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-stone-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">手書きは非効率</h3>
                    <p className="text-stone-600 leading-relaxed">
                      1通20分かけて書いても、相手に刺さらない文面では意味がありません。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Solution */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-amber-800">
                URL解析 × 才流メソッド
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-800/10 rounded-full flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">相手の課題を自動分析</h3>
                    <p className="text-stone-600 leading-relaxed">
                      企業URLを入力するだけで、AIが相手の事業内容・課題・ニーズを瞬時に分析します。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-800/10 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">刺さる文面を自動生成</h3>
                    <p className="text-stone-600 leading-relaxed">
                      才流のCxOレターメソッドに基づき、決裁者の心を動かす手紙を30秒で生成します。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              使い方はシンプル
            </h2>
            <p className="text-xl text-stone-600">
              3ステップで、決裁者に届く手紙が完成します。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg">
                1
              </div>
              <div className="pt-8 space-y-4">
                <div className="w-16 h-16 bg-amber-800/10 rounded-lg flex items-center justify-center ml-auto">
                  <Target className="w-8 h-8 text-amber-800" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-stone-900">
                  企業URLを入力
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  送りたい企業のホームページURLを入力するだけ。AIが自動的に情報を収集します。
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg">
                2
              </div>
              <div className="pt-8 space-y-4">
                <div className="w-16 h-16 bg-amber-800/10 rounded-lg flex items-center justify-center ml-auto">
                  <Sparkles className="w-8 h-8 text-amber-800" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-stone-900">
                  AIが文面を生成
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  相手の課題を分析し、才流メソッドに基づいた説得力のある手紙を自動生成します。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg">
                3
              </div>
              <div className="pt-8 space-y-4">
                <div className="w-16 h-16 bg-amber-800/10 rounded-lg flex items-center justify-center ml-auto">
                  <Download className="w-8 h-8 text-amber-800" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-stone-900">
                  PDF/Wordで出力
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  生成された手紙をPDFまたはWord形式でダウンロード。印刷して投函するだけです。
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/new"
              className="group inline-flex items-center justify-center gap-2 px-10 py-5 bg-stone-900 text-stone-50 rounded-md font-medium text-xl hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl"
            >
              今すぐ無料で始める
              <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-sm text-stone-500">
              クレジットカード不要 / すべての機能が無料
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* ブランド */}
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-2">CxO Letter Maker</h3>
              <p className="text-sm text-stone-600">決裁者に届く、本気の手紙。</p>
            </div>

            {/* リンク */}
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">サービス</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/new" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    手紙を作成
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    ログイン
                  </Link>
                </li>
              </ul>
            </div>

            {/* 法務 */}
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">法的情報</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    プライバシーポリシー
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* コピーライト */}
          <div className="border-t border-stone-200 pt-8 text-center">
            <p className="text-sm text-stone-500">
              © 2025 CxO Letter Maker. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
