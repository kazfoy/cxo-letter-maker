'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { Suspense } from 'react';

function SuccessContent() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan') || 'pro';
    const planInfo = plan === 'premium' ?
        { name: 'Premium', limit: '1,000件', features: ['CSV一括生成（1,000件/日）', '全履歴の保存', 'Wordダウンロード', '最優先サポート'] } :
        { name: 'Pro', limit: '100件', features: ['CSV一括生成（100件/日）', '全履歴の保存', 'Wordダウンロード', '優先サポート'] };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-12 text-center text-white">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-6">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">アップグレード完了！</h1>
                    <p className="text-emerald-50 opacity-90 text-lg">
                        {planInfo.name}プランへの登録が正常に完了しました
                    </p>
                </div>

                <div className="p-8 md:p-12">
                    <div className="space-y-8">
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                                新しく利用可能になった機能
                            </h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {planInfo.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-700">
                                        <Zap className="w-5 h-5 text-amber-500" />
                                        <span className="font-medium">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center space-y-4">
                            <p className="text-slate-600">
                                本日から、CSV一括生成が <span className="text-indigo-600 font-bold">{planInfo.limit}/日</span> までご利用いただけます。
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
                                >
                                    ダッシュボードへ
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                                <Link
                                    href="/bulk"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
                                >
                                    一括作成を始める
                                    <Zap className="w-5 h-5 text-amber-500" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-center mt-8 text-slate-500 text-sm">
                領収書はご登録のメールアドレスに送信されます。<br />
                プランの管理・解約は設定画面からいつでも行えます。
            </p>
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:py-20">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-slate-600">読み込み中...</p>
                </div>
            }>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
