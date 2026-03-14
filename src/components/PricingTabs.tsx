'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeButton } from '@/components/UpgradeButton';
import { Users } from 'lucide-react';

type Tab = 'individual' | 'team';

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5 text-stone-400 flex-shrink-0'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ProCheckIcon() {
  return (
    <div className="bg-amber-100 rounded-full p-1">
      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

function TeamCheckIcon() {
  return (
    <div className="bg-amber-500/20 rounded-full p-1 ring-2 ring-amber-400">
      <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

export function PricingTabs() {
  const [tab, setTab] = useState<Tab>('individual');

  return (
    <>
      {/* Tab Switcher */}
      <div className="flex justify-center mb-12">
        <div className="bg-stone-100 rounded-full p-1 inline-flex">
          <button
            onClick={() => setTab('individual')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              tab === 'individual'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            個人向け
          </button>
          <button
            onClick={() => setTab('team')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 ${
              tab === 'team'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Users className="w-4 h-4" />
            チーム向け
          </button>
        </div>
      </div>

      {/* Individual Plans */}
      {tab === 'individual' && (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="bg-stone-50 rounded-2xl p-5 sm:p-8 border border-stone-200 shadow-sm flex flex-col">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-stone-900 mb-2">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-stone-900">0</span>
                <span className="text-stone-600 font-medium">円 / 月</span>
              </div>
              <p className="text-stone-600 mt-4 text-sm mb-6">
                まずはお試しで使ってみたい方に
              </p>
              <Link
                href="/new?demo=true"
                className="block w-full py-3 px-4 min-h-[44px] bg-white border-2 border-stone-200 text-stone-900 font-bold text-center rounded-lg hover:bg-stone-50 transition-colors"
              >
                無料で試す
              </Link>
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm font-bold text-stone-900">主な機能:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-stone-700">
                  <CheckIcon />
                  <span>1日10回まで生成可能</span>
                </li>
                <li className="flex items-start gap-3 text-stone-700">
                  <CheckIcon />
                  <span>最新10件の履歴保存</span>
                </li>
                <li className="flex items-start gap-3 text-stone-700">
                  <CheckIcon />
                  <span>AIによる企業分析 &amp; 生成</span>
                </li>
                <li className="flex items-start gap-3 text-stone-500">
                  <ArrowIcon />
                  <span>
                    深層分析・品質保証 <span className="text-amber-700 font-semibold">Proで利用可</span>
                  </span>
                </li>
                <li className="flex items-start gap-3 text-stone-500">
                  <ArrowIcon />
                  <span>
                    CSV一括生成 <span className="text-amber-700 font-semibold">Proで利用可</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl p-5 sm:p-8 border-2 border-amber-800 shadow-xl relative flex flex-col">
            <div className="absolute top-0 right-0 bg-amber-800 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-2xl">
              おすすめ
            </div>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-amber-800 mb-2">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-stone-900">1,980</span>
                <span className="text-stone-600 font-medium">円 / 月 (税込)</span>
              </div>
              <p className="text-stone-600 mt-4 text-sm mb-6">
                その企業にしか刺さらないレターで、商談数を最大化したい方に
              </p>
              <UpgradeButton
                plan="pro"
                label="7日間無料で試す"
                className="block w-full py-3 px-4 bg-gradient-to-r from-amber-700 to-amber-900 text-white font-bold text-center rounded-lg hover:from-amber-800 hover:to-amber-950 transition-all shadow-md transform hover:scale-[1.02] disabled:opacity-50"
              />
              <p className="text-xs text-stone-400 text-center mt-2">トライアル後 ¥1,980/月</p>
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm font-bold text-stone-900">Freeプランとの違い:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <div>
                    <span className="text-amber-800 font-bold">深層分析（最大12ページ探索）</span>
                    <p className="text-xs text-stone-600 mt-0.5">Freeは1ページのみ。Proは企業サイトを深く分析</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <div>
                    <span className="text-amber-800 font-bold">品質スコア80点以上を自動保証</span>
                    <p className="text-xs text-stone-600 mt-0.5">AIが自己修正ループで品質を担保</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <span>3バリエーション同時生成 + 件名5候補</span>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <div>
                    <span className="text-amber-800 font-bold">CSV一括生成（100件/日）</span>
                    <p className="text-xs text-stone-600 mt-0.5">月最大3,000件のリストを一括処理</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <span>全モード対応 + 引用元トラッキング</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Team Plans */}
      {tab === 'team' && (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Team Plan */}
          <div className="bg-white rounded-2xl p-5 sm:p-8 border-2 border-amber-800 shadow-xl relative flex flex-col">
            <div className="absolute top-0 right-0 bg-amber-800 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-2xl">
              おすすめ
            </div>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-amber-800 mb-2">Team</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-stone-900">20,000</span>
                <span className="text-stone-600 font-medium">円 / 月 (税込)</span>
              </div>
              <p className="text-stone-500 text-xs mt-1">5名まで利用可能 / 1人あたり4,000円</p>
              <p className="text-stone-600 mt-3 text-sm mb-6">
                チーム全員でPro品質のレターを共有・活用したい方に
              </p>
              <UpgradeButton
                plan="team"
                label="チームプランを始める"
                className="block w-full py-3 px-4 bg-gradient-to-r from-amber-700 to-amber-900 text-white font-bold text-center rounded-lg hover:from-amber-800 hover:to-amber-950 transition-all shadow-md transform hover:scale-[1.02] disabled:opacity-50"
              />
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm font-bold text-stone-900">Proプランの全機能に加え:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <div>
                    <span className="text-amber-800 font-bold">チームメンバー管理（5席）</span>
                    <p className="text-xs text-stone-600 mt-0.5">招待リンクで簡単にメンバー追加</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <div>
                    <span className="text-amber-800 font-bold">共有テンプレート</span>
                    <p className="text-xs text-stone-600 mt-0.5">差出人情報・設定をチームで共有</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <span>CSV一括生成（500件/日・チーム合計）</span>
                </li>
                <li className="flex items-start gap-3 text-stone-900 font-medium">
                  <ProCheckIcon />
                  <span>チーム利用状況ダッシュボード</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Business Plan */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 sm:p-8 border-2 border-slate-700 shadow-2xl relative flex flex-col text-white">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-600 to-amber-800 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              ENTERPRISE
            </div>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Business</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">50,000</span>
                <span className="text-slate-300 font-medium">円 / 月 (税込)</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">20名まで利用可能 / 1人あたり2,500円</p>
              <p className="text-slate-300 mt-3 text-sm mb-6">
                大規模チームで営業活動を一括効率化したい企業に
              </p>
              <UpgradeButton
                plan="business"
                label="Businessプランを始める"
                className="block w-full py-3 px-4 bg-gradient-to-r from-amber-700 to-amber-900 text-white font-bold text-center rounded-lg hover:from-amber-800 hover:to-amber-950 transition-all shadow-lg transform hover:scale-[1.02] disabled:opacity-50"
              />
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm font-bold text-white">Teamプランの全機能に加え:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-white font-medium">
                  <TeamCheckIcon />
                  <div>
                    <span className="text-amber-400 font-bold">チームメンバー管理（20席）</span>
                    <p className="text-xs text-slate-300 mt-0.5">大規模な営業組織に対応</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <TeamCheckIcon />
                  <div>
                    <span>CSV一括生成（2,000件/日）</span>
                    <p className="text-xs text-slate-400 mt-0.5">展示会後の大量リードも即日対応</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <TeamCheckIcon />
                  <span>優先サポート</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
