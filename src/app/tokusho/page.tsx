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
                        <table className="w-full border-collapse">
                            <tbody className="divide-y divide-stone-200">
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap w-1/3 min-w-[160px]">
                                        販売業者
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        橋村一甫
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
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
                                        東京都江東区永代2-33-3-306
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        電話番号
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        080-2528-4439<br />
                                        <span className="text-sm text-stone-500 mt-1 block">
                                            ※受付時間: 平日 10:00〜18:00<br />
                                            ※サービスに関するお問い合わせは、記録保持の観点からメールまたはお問い合わせフォームよりお願いいたします。
                                        </span>
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
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>ベーシックプラン（Pro）: 月額980円（税込）</li>
                                            <li>上位プラン（Premium）: 月額9,800円（税込）</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        商品代金以外の必要料金
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        サイトの閲覧、コンテンツのダウンロード、お問い合わせ等の際の電子メールの送受信時などに、所定の通信料が発生いたします。
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        お支払方法
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        クレジットカード決済
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        代金の支払時期
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        初回お申し込み時に決済され、以降は1ヶ月ごとの自動更新となります（毎月同日に請求）。
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        商品の引渡時期
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        クレジットカード決済完了後、直ちにご利用いただけます。
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        返品・キャンセル（解約）について
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        <ul className="list-disc list-inside space-y-2">
                                            <li>デジタルコンテンツの性質上、決済完了後の返品・返金はいかなる場合でもお受けできません。</li>
                                            <li>解約は、サービス内の設定画面よりいつでも行っていただけます。</li>
                                            <li>解約手続きを行った場合、次回の請求日から課金が停止されます。既にお支払いいただいた期間（契約期間）の途中解約による日割り返金は行われません。契約期間終了までサービスをご利用いただけます。</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 pr-4 text-left text-stone-900 font-semibold align-top whitespace-nowrap">
                                        動作環境
                                    </th>
                                    <td className="py-4 text-stone-700">
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>推奨ブラウザ: Google Chrome, Safari, Microsoft Edge, Firefox の最新版</li>
                                            <li>JavaScript: 有効に設定してください</li>
                                        </ul>
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
