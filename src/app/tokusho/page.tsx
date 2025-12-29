import Link from 'next/link';

export default function TokushoPage() {
    return (
        <div className="min-h-screen bg-stone-50">
            <div className="max-w-4xl mx-auto px-6 py-16">
                {/* ヘッダー */}
                <div className="mb-12">
                    <Link href="/" className="inline-block text-stone-600 hover:text-stone-900 mb-6 transition-colors">
                        ← トップページに戻る
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
                        特定商取引法に基づく表記
                    </h1>
                    <p className="text-stone-600">最終更新日: 2025年1月1日</p>
                </div>

                {/* 本文 */}
                <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 md:p-12">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <tbody className="divide-y divide-stone-200">
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap w-1/3">
                                        運営統括責任者
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        橋村一甫
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        所在地
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        {/* TODO: 正しい住所に更新してください */}
                                        〒135-0034 東京都江東区永代2-33-3-306
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        電話番号
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        {/* TODO: 正しい電話番号に更新してください */}
                                        080-2528-4439
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        メールアドレス
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        fairlucia+support@gmail.com
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        販売価格
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        月額980円（税込）
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        商品代金以外の必要料金
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        インターネット接続料金、通信料金
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        お支払方法
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        クレジットカード決済（Stripe）
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        お支払時期
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        初回お申し込み時に決済、以降は毎月同日に自動決済
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        商品の引渡時期
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        決済完了後、直ちにご利用いただけます
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        返品・キャンセル
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        デジタルコンテンツの性質上、決済完了後の返品・返金はお受けしておりません。解約は設定画面よりいつでも可能です（次回更新日まで利用可能）。
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 pt-8 border-t border-stone-200">
                        <p className="text-stone-600 text-sm">
                            本表記に関するお問い合わせは、上記メールアドレスまでご連絡ください。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
