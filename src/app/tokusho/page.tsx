import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '特定商取引法に基づく表記 | CxO Letter Maker',
    description: 'CxO Letter Makerの特定商取引法に基づく表記です。',
    robots: {
        index: false,
        follow: false,
    },
    alternates: {
        canonical: 'https://cxo-letter.jp/tokusho',
    },
};

export default function TokushoPage() {
    return (
        <div className="min-h-screen bg-stone-50">
            <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
                {/* ヘッダー */}
                <div className="mb-8 md:mb-12">
                    <Link href="/" className="inline-flex items-center text-stone-600 hover:text-stone-900 mb-6 transition-colors text-sm font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        トップページに戻る
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 mb-2">
                        特定商取引法に基づく表記
                    </h1>
                </div>

                {/* 本文 */}
                <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-stone-200">
                                {/* 販売業者 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900 w-1/3 min-w-[180px]">
                                        販売業者
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        橋村一甫
                                    </td>
                                </tr>

                                {/* 運営統括責任者名 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        運営統括責任者名
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        橋村一甫
                                    </td>
                                </tr>

                                {/* 所在地 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        所在地
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        〒135-0034 東京都江東区永代2-33-3-306
                                    </td>
                                </tr>

                                {/* 電話番号 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        電話番号
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        080-2528-4439<br />
                                        <span className="text-stone-500 text-xs mt-1 block">
                                            ※サービスに関するお問い合わせは、記録保持の観点から原則としてメールまたはお問い合わせフォームよりお願いいたします。<br />
                                            ※電話受付時間：平日 10:00〜18:00
                                        </span>
                                    </td>
                                </tr>

                                {/* メールアドレス */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        メールアドレス
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        fairlucia+support@gmail.com
                                    </td>
                                </tr>

                                {/* 販売価格 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        販売価格
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        各プランの申し込みページに表示された金額（表示価格/消費税込）とします。<br />
                                        ・Proプラン: 月額980円（税込）<br />
                                        ・Premiumプラン: 月額9,800円（税込）
                                    </td>
                                </tr>

                                {/* 商品代金以外の必要料金 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        商品代金以外の必要料金
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        サイトの閲覧、コンテンツのダウンロード、お問い合わせ等の際の電子メールの送受信時などに、所定の通信料が発生いたします。
                                    </td>
                                </tr>

                                {/* お支払方法 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        お支払方法
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        クレジットカード決済（Stripe）
                                    </td>
                                </tr>

                                {/* 代金の支払時期 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        代金の支払時期
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        初回お申し込み時に決済され、以降は1ヶ月ごとの自動更新となります（毎月同日に請求）。<br />
                                        実際の引き落とし時期は、ご利用のクレジットカード会社の規定に基づきます。
                                    </td>
                                </tr>

                                {/* 商品の引渡時期 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        商品の引渡時期
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        クレジットカード決済完了後、直ちにご利用いただけます。
                                    </td>
                                </tr>

                                {/* 申込みの有効期限 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        申込みの有効期限
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        特になし。
                                    </td>
                                </tr>

                                {/* 販売数量の制限 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        販売数量の制限
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700">
                                        特になし。
                                    </td>
                                </tr>

                                {/* 返品・キャンセル（解約）について */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        返品・キャンセル（解約）について
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        <div className="mb-4">
                                            <strong>1. 返品・交換について</strong><br />
                                            本商品はデジタルコンテンツとしての性質上、決済完了後の返品・交換・返金はいかなる場合でもお受けできません。
                                        </div>
                                        <div>
                                            <strong>2. 解約について</strong><br />
                                            サービス内の設定画面よりいつでも解約手続きを行っていただけます。<br />
                                            解約手続きを行った場合、次回の請求日から課金が停止されます。<br />
                                            既にお支払いいただいた期間（契約期間）の途中解約による日割り返金は行われません。契約期間終了までサービスをご利用いただけます。
                                        </div>
                                    </td>
                                </tr>

                                {/* 動作環境 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        動作環境
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        <div className="mb-2">
                                            <strong>推奨ブラウザ</strong><br />
                                            Google Chrome, Safari, Microsoft Edge, Firefox の最新版
                                        </div>
                                        <div>
                                            <strong>その他</strong><br />
                                            JavaScript: 有効に設定してください
                                        </div>
                                    </td>
                                </tr>

                                {/* 隠れた瑕疵に関する責任 */}
                                <tr>
                                    <th className="bg-stone-50 px-6 py-4 text-sm font-bold text-stone-900">
                                        隠れた瑕疵に関する責任
                                    </th>
                                    <td className="px-6 py-4 text-sm text-stone-700 leading-relaxed">
                                        当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。現状有姿にて提供いたします。
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
