'use client';

import { X, Check, Sparkles } from 'lucide-react';
import { useCheckout } from '@/hooks/useCheckout';
import { getPlanConfig } from '@/config/subscriptionPlans';

interface PlanSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Free vs Pro の質ベース比較を見せるプラン選択モーダル
 */
export function PlanSelectionModal({ isOpen, onClose }: PlanSelectionModalProps) {
    const { handleUpgrade, loading } = useCheckout();

    if (!isOpen) return null;

    const proPlan = getPlanConfig('pro');

    const comparisonItems = [
        { label: 'URL分析', free: 'トップページ1ページのみ', pro: '最大12ページ深層探索 + Google検索補完' },
        { label: 'レター品質', free: '1回生成（品質スコアなし）', pro: '品質スコア80点以上を自動保証' },
        { label: 'バリエーション', free: 'なし', pro: '3種（標準/感情/相談）' },
        { label: '件名候補', free: '1つ', pro: '5つ（A/Bテスト対応）' },
        { label: '引用トラッキング', free: 'なし', pro: 'ソース付き引用表示' },
        { label: 'モード', free: '下書きのみ', pro: '下書き / 完成 / イベント招待状' },
        { label: 'CSV一括生成', free: 'なし', pro: '100件/日' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8 md:p-12">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Proで「刺さるレター」に</h2>
                        <p className="text-slate-600 text-lg">
                            同じURL入力でも、分析の深さとレターの質が変わります。
                        </p>
                    </div>

                    {/* 比較テーブル */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                        <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200">
                            <div className="p-4 text-sm font-medium text-slate-500"></div>
                            <div className="p-4 text-center text-sm font-bold text-slate-600">Free</div>
                            <div className="p-4 text-center text-sm font-bold text-amber-800 bg-amber-50/50">
                                <span className="flex items-center justify-center gap-1">
                                    <Sparkles className="w-4 h-4" />
                                    Pro
                                </span>
                            </div>
                        </div>
                        {comparisonItems.map((item, i) => (
                            <div key={i} className={`grid grid-cols-3 ${i < comparisonItems.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                <div className="p-4 text-sm font-medium text-slate-700">{item.label}</div>
                                <div className="p-4 text-sm text-slate-500 text-center">{item.free}</div>
                                <div className="p-4 text-sm text-slate-900 text-center bg-amber-50/30 font-medium">{item.pro}</div>
                            </div>
                        ))}
                    </div>

                    {/* Pro プラン CTA */}
                    <div className="border-2 border-amber-600 rounded-2xl p-8 bg-white">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{proPlan.label}プラン</h3>
                                <p className="text-slate-600 text-sm mt-1">{proPlan.description}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl font-bold text-slate-900">¥{proPlan.price.toLocaleString()}</span>
                                <span className="text-slate-500">/月</span>
                            </div>
                        </div>

                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                            {proPlan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleUpgrade('pro')}
                            disabled={loading}
                            className="w-full py-4 px-6 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-bold hover:from-amber-800 hover:to-amber-900 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {loading ? '処理中...' : '7日間無料で試す'}
                        </button>
                        <p className="text-xs text-slate-400 text-center mt-2">トライアル後 ¥{proPlan.price.toLocaleString()}/月・いつでもキャンセル可</p>
                    </div>

                    <p className="mt-6 text-slate-500 text-sm text-center">
                        ※ いつでもマイページからプランの管理・解約が可能です。
                    </p>
                </div>
            </div>
        </div>
    );
}
