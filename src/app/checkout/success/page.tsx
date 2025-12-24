'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Zap, List } from 'lucide-react';

export default function CheckoutSuccessPage() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan') || 'pro';
    const isPremium = plan === 'premium';

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header Section */}
                <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="mx-auto bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            アップグレード完了！
                        </h1>
                        <p className="text-indigo-100">
                            {isPremium ? 'Premium' : 'Pro'}プランへの登録が完了しました。
                        </p>
                    </div>

                    {/* Decorative background elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-white blur-xl"></div>
                        <div className="absolute bottom-10 right-10 w-32 h-32 rounded-full bg-white blur-xl"></div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8">
                    <div className="text-center mb-8">
                        <p className="text-slate-600">
                            すべての機能が解放されました。<br />
                            さっそく、より高度な手紙作成を始めましょう。
                        </p>
                    </div>

                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                        {isPremium ? 'Premium' : 'Pro'} Plan Features
                    </h2>

                    <div className="grid gap-4 mb-8">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                            <div className="bg-indigo-100 p-2 rounded-md">
                                <List className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">CSV一括生成</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    {isPremium ? '1日1,000件' : '1日100件'}までのCSV一括生成が可能です。
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                            <div className="bg-indigo-100 p-2 rounded-md">
                                <Zap className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">無制限のAI生成</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    1日の回数制限を気にせず、納得いくまで何度もリライトや生成を試せます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href="/dashboard"
                            className="flex-1 px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            ダッシュボードへ
                        </Link>
                        <Link
                            href="/new"
                            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            手紙を作成する
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
