import { BulkGenerator } from '@/components/BulkGenerator';
import { Header } from '@/components/Header';

export default function BulkPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">一括生成ツール</h1>
                    <p className="text-slate-600 mt-2">
                        CSVファイルをアップロードして、複数の宛先への手紙をまとめて生成します。
                    </p>
                </div>
                <BulkGenerator />

                {/* Security Note */}
                <div className="max-w-2xl mx-auto mt-8">
                    <details className="group bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <summary className="cursor-pointer px-6 py-4 font-semibold text-slate-800 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <span className="flex items-center gap-2">
                                <span className="text-xl">🔒</span>
                                セキュリティについて
                            </span>
                            <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </summary>
                        <div className="px-6 pb-6 pt-2 text-sm text-slate-600 space-y-3 bg-white">
                            <div className="flex gap-3">
                                <span className="text-lg">🔒</span>
                                <div>
                                    <span className="font-bold text-slate-800">プライバシー保護</span>
                                    <p className="mt-0.5">アップロードされたデータは暗号化され、あなた以外は閲覧できません。</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-lg">🤖</span>
                                <div>
                                    <span className="font-bold text-slate-800">学習利用なし</span>
                                    <p className="mt-0.5">データがAIの学習に使われることはありません。</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-lg">🗑️</span>
                                <div>
                                    <span className="font-bold text-slate-800">データ削除</span>
                                    <p className="mt-0.5">生成履歴はいつでも完全に削除可能です。</p>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </main>
        </div>
    );
}
