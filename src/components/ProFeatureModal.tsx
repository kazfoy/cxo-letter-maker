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
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
                {/* Pro Badge / Decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-2">Proプラン限定機能</h3>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    <span className="font-bold text-indigo-600">{featureName}</span>機能は<br />
                    Proプラン（有料）のユーザー様のみご利用いただけます。
                </p>

                <div className="space-y-3">
                    <Link
                        href="/pricing" // 仮のリンク
                        className="block w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105"
                    >
                        Proプランにアップグレード
                    </Link>
                    <button
                        onClick={onClose}
                        className="block w-full py-3 px-4 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
