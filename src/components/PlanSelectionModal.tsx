'use client';

import { X, Zap, Check, Rocket } from 'lucide-react';
import { useCheckout } from '@/hooks/useCheckout';
import { PLANS, PlanType, getPlanConfig } from '@/config/subscriptionPlans';

interface PlanSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PlanSelectionModal({ isOpen, onClose }: PlanSelectionModalProps) {
    const { handleUpgrade, loading } = useCheckout();

    if (!isOpen) return null;

    const proPlan = getPlanConfig('pro');
    const premiumPlan = getPlanConfig('premium');

    const onSelectPlan = async (type: PlanType) => {
        await handleUpgrade(type);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8 md:p-12 text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">プランをアップグレード</h2>
                    <p className="text-slate-600 mb-10 text-lg">
                        あなたの営業活動に合わせた最適なプランを選択してください。
                    </p>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Pro Plan */}
                        <div className="border border-slate-200 rounded-2xl p-8 flex flex-col text-left hover:border-indigo-300 transition-colors shadow-sm bg-slate-50/30">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{proPlan.label}</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-4xl font-bold text-slate-900">¥{proPlan.price.toLocaleString()}</span>
                                    <span className="text-slate-500">/月</span>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {proPlan.description}
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {proPlan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => onSelectPlan('pro')}
                                disabled={loading}
                                className="w-full py-4 px-6 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                {loading ? '処理中...' : 'Proプランを選択'}
                            </button>
                        </div>

                        {/* Premium Plan */}
                        <div className="relative rounded-2xl p-8 flex flex-col text-left border-2 border-indigo-600 shadow-xl bg-white overflow-hidden group">
                            {/* Popular Badge */}
                            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
                                Recommended
                            </div>

                            <div className="mb-6 relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-xl font-bold text-slate-900">{premiumPlan.label}</h3>
                                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                                </div>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-4xl font-bold text-slate-900">¥{premiumPlan.price.toLocaleString()}</span>
                                    <span className="text-slate-500">/月</span>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {premiumPlan.description}
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1 relative z-10">
                                {premiumPlan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                                        <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <span className={i === 1 ? 'font-bold text-indigo-900' : ''}>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => onSelectPlan('premium')}
                                disabled={loading}
                                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Rocket className="w-5 h-5" />
                                {loading ? '処理中...' : 'Premiumプランを選択'}
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-slate-500 text-sm">
                        ※ いつでもマイページからプランの管理・解約が可能です。
                    </p>
                </div>
            </div>
        </div>
    );
}
