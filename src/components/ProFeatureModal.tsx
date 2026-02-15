import Link from 'next/link';

interface ProFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureName: string;
}

export function ProFeatureModal({ isOpen, onClose, featureName }: ProFeatureModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
                {/* Pro Badge / Decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 to-amber-800"></div>

                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>

                <h3 className="text-2xl font-bold text-stone-900 mb-2 text-center">Proプランで、もっと成果を</h3>
                <p className="text-stone-600 mb-6 leading-relaxed text-center">
                    <span className="font-bold text-amber-800">{featureName}</span>はProプラン限定機能です。
                </p>

                {/* Proプランの具体的な価値 */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-bold text-amber-900 mb-3">Proプランでできること:</p>
                    <ul className="space-y-2.5">
                        <li className="flex items-start gap-2 text-sm text-stone-700">
                            <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span><strong>Word出力</strong> - そのまま印刷・投函できる形式</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-stone-700">
                            <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span><strong>CSV一括生成</strong> - 毎日100件のリストを自動処理</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-stone-700">
                            <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span><strong>AI編集 無制限</strong> - 納得いくまで何度でも調整</span>
                        </li>
                    </ul>
                </div>

                {/* Free vs Pro 比較 */}
                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
                        <p className="text-stone-400 font-medium mb-1">Free</p>
                        <p className="text-stone-600">1日10回 / コピーのみ</p>
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-center">
                        <p className="text-amber-800 font-bold mb-1">Pro <span className="text-xs">980円/月</span></p>
                        <p className="text-stone-700">無制限 / Word / CSV</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <Link
                        href="/#pricing"
                        className="block w-full py-3 px-4 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 text-center"
                    >
                        プラン詳細を見る
                    </Link>
                    <button
                        onClick={onClose}
                        className="block w-full py-3 px-4 text-stone-500 hover:text-stone-700 font-medium transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
