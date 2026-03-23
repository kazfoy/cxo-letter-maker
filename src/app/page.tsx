import Link from 'next/link';
import Image from 'next/image';
import { Mail, Target, Zap, FileText, Download, Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import { UpgradeButton } from '@/components/UpgradeButton';
import { PricingTabs } from '@/components/PricingTabs';

export default function LandingPage() {
  // ログイン済みユーザーは自動的に /dashboard へリダイレクト

  // JSON-LD構造化データ for AI検索エンジン対策
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "CxO Letter Maker",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Application",
    "offers": [
      {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "JPY",
        "name": "Free Plan"
      },
      {
        "@type": "Offer",
        "price": "1980",
        "priceCurrency": "JPY",
        "name": "Pro Plan"
      },
      {
        "@type": "Offer",
        "price": "9800",
        "priceCurrency": "JPY",
        "name": "Premium Plan"
      },
      {
        "@type": "Offer",
        "price": "20000",
        "priceCurrency": "JPY",
        "name": "Team Plan"
      },
      {
        "@type": "Offer",
        "price": "50000",
        "priceCurrency": "JPY",
        "name": "Business Plan"
      }
    ],
    "description": "AIを活用して、企業の決裁者（CxO）に響く高品質なセールスレターやイベント招待状を自動生成。営業効率の向上をサポートします。",
    "featureList": [
      "企業URLからAIが自動で事業内容・課題を分析",
      "BtoB営業専門家監修メソッドに基づいた文面生成",
      "30秒で決裁者に刺さる手紙を作成",
      "Word形式でダウンロード可能",
      "CSV一括生成機能で大量のレター作成に対応"
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "本当に無料で使えますか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "はい、無料プランをご用意しております。1日10回までの生成、基本的なAI分析でのご利用が可能です。Proプラン（月額1,980円）では深層分析・品質保証・3バリエーション生成など、より高品質なレター生成をご利用いただけます。"
        }
      },
      {
        "@type": "Question",
        "name": "どのように使うのですか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "送りたい企業のホームページURLを入力し、必要な情報（自社名、サービス内容など）を入力するだけです。AIが企業情報を自動解析し、個別最適化されたレターを30秒で生成します。"
        }
      },
      {
        "@type": "Question",
        "name": "アカウント登録は必要ですか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "登録なしでもご利用いただけます。ただし、過去に作成したレターの履歴を保存したい場合は、無料アカウント登録をおすすめします。"
        }
      },
      {
        "@type": "Question",
        "name": "生成されたレターはどのような形式でダウンロードできますか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Word（.docx）形式でダウンロード可能です。そのまま印刷して投函できる形式になっています。現在、PDF形式でのダウンロードには対応しておりません。"
        }
      },
      {
        "@type": "Question",
        "name": "入力した情報はAIの学習に使われますか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "いいえ、一切使用されません。入力データおよび生成されたコンテンツは、AIモデルの学習には使用しない契約を結んでいます。あなたのビジネス情報は厳重に保護されます。"
        }
      },
      {
        "@type": "Question",
        "name": "アップロードした顧客リストや生成データは安全ですか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "はい、万全の対策を行っております。データは高度な暗号化技術を用いて保存され、お客様ご本人以外からは一切アクセスできない仕組み（RLS）を採用しています。また、生成AI（Google Gemini）に送信されるデータは生成目的のみに使用され、AIの学習データとして二次利用されることはありません。"
        }
      },
      {
        "@type": "Question",
        "name": "生成されたレターは編集できますか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "はい、生成されたレターはプレビュー画面で直接編集できます。また、Word形式でダウンロード後に自由に編集することも可能です。"
        }
      },
      {
        "@type": "Question",
        "name": "AIの分析精度はどのくらいですか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "最新のAI技術を使用し、企業のWebサイトから事業内容、課題、ニーズを高精度で分析します。BtoB営業の専門家が監修したメソッドに基づいているため、実務で即使えるレベルの品質を実現しています。"
        }
      },
      {
        "@type": "Question",
        "name": "何通まで生成できますか？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "無料プランは1日10通まで（個別生成のみ）、Proプラン（月額1,980円）は個別生成無制限 + CSV一括生成100件/日となっています。Proプランでは深層分析や品質保証など、レターの質が大幅に向上します。"
        }
      }
    ]
  };

  // NOTE: レビュー構造化データ（reviewSchema）は実績に基づくレビュー取得後に追加する
  // 架空のaggregateRating/reviewはGoogleガイドライン違反のため削除済み

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      {/* JSON-LD構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/30 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <div className="inline-block animate-fade-in">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold shadow-lg animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                  登録不要ですぐに試せます
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-black text-stone-900 leading-[1.2] tracking-tight">
                決裁者に届く営業レターを、<br className="hidden md:block" /><span className="text-amber-800">AIが30秒で作成。</span>
              </h1>

              <p className="text-lg md:text-xl text-stone-600 leading-relaxed mt-4">
                企業のIR・ニュースから根拠を自動抽出。<br className="hidden md:block" />CxOが返信したくなるレターを30秒で生成。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Link
                  href="/new?demo=true"
                  className="group inline-flex items-center justify-center gap-2 px-10 py-4 min-h-[44px] bg-amber-800 text-white rounded-md font-bold text-lg hover:bg-amber-900 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  いますぐレターを作成する（無料）
                  <Mail className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <p className="text-sm text-stone-400 pt-3">
                登録不要・企業URL入力だけ・クレカ不要
              </p>
            </div>

            {/* Right: Visual Mockup */}
            <div className="relative">
              <div className="relative w-full max-w-lg mx-auto animate-float">
                <Image
                  src="/images/hero-mockup.png"
                  alt="CxO Letter Maker Interface"
                  width={600}
                  height={500}
                  className="w-full h-auto drop-shadow-2xl rounded-lg"
                  priority
                />
              </div>

              {/* Background Decoration */}

              {/* Background Decoration */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-800/5 rounded-full blur-3xl -z-10"></div>
              <div className="absolute -bottom-8 -left-8 w-full h-full bg-stone-900/5 rounded-xl -z-10 rotate-3"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section id="features" className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left: Problem */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900">
                メールは読まれない。手書きは時間がかかる。
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-stone-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">メールは開封されない</h3>
                    <p className="text-stone-600 leading-relaxed">
                      決裁者のメールボックスには1日100通以上のメールが届きます。あなたの提案は読まれていません。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-stone-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">手書きは非効率</h3>
                    <p className="text-stone-600 leading-relaxed">
                      1通20分かけて書いても、相手に刺さらない文面では意味がありません。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Solution */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-amber-800">
                AI企業分析 × 専門家監修メソッド
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-800/10 rounded-full flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">相手の課題を自動分析</h3>
                    <p className="text-stone-600 leading-relaxed">
                      企業URLを入力するだけで、AIが相手の事業内容・課題・ニーズを瞬時に分析します。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-800/10 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">刺さる文面を自動生成</h3>
                    <p className="text-stone-600 leading-relaxed">
                      BtoB営業専門家監修メソッドに基づき、決裁者の心を動かす手紙を30秒で生成します。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              従来の営業手紙との比較
            </h2>
            <p className="text-xl text-stone-600">
              圧倒的な効率化と、より高い成果を実現します。
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-stone-500 w-1/3">比較項目</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-stone-500 w-1/3">従来の手紙作成</th>
                    <th className="px-6 py-4 text-center bg-amber-50 border-l border-stone-200">
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-800" />
                        <span className="text-sm font-bold text-amber-800">CxO Letter Maker</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">作成時間</td>
                    <td className="px-6 py-5 text-center text-stone-600">1通あたり20〜30分</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold text-lg">30秒</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">企業リサーチ</td>
                    <td className="px-6 py-5 text-center text-stone-600">手作業で収集・分析</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold">AI が自動解析</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">個別最適化</td>
                    <td className="px-6 py-5 text-center text-stone-600">ライターのスキル次第</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold">常に最適化された提案</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">品質の一貫性</td>
                    <td className="px-6 py-5 text-center text-stone-600">担当者や体調で変動</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold">常に高品質を維持</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">スケーラビリティ</td>
                    <td className="px-6 py-5 text-center text-stone-600">1日5〜10通が限界</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold">無制限に生成可能</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-5 text-stone-900 font-medium">コスト</td>
                    <td className="px-6 py-5 text-center text-stone-600">人件費 + 時間コスト</td>
                    <td className="px-6 py-5 text-center bg-amber-50/30 border-l border-stone-200">
                      <span className="text-amber-800 font-bold text-lg">無料で開始</span>
                      <p className="text-xs text-stone-500 mt-1">※ Pro / Premium プランで高度な機能を利用可能</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-lg text-stone-700 font-medium mb-6">
              アポ率の向上と、作業時間の<span className="text-amber-800 font-bold">大幅短縮</span>を両立できます。
            </p>
            <Link
              href="/new?demo=true"
              className="inline-flex items-center gap-2 px-8 py-3 min-h-[44px] bg-amber-800 text-white rounded-md font-bold hover:bg-amber-900 transition-all shadow-lg hover:shadow-xl"
            >
              いますぐレターを作成する（無料）
              <Mail className="w-5 h-5" />
            </Link>
            <p className="text-sm text-stone-400 mt-3">
              登録不要・企業URL入力だけ・クレカ不要
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="pt-16 pb-24 md:pt-20 md:pb-32 bg-stone-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              使い方はシンプル
            </h2>
            <p className="text-xl text-stone-600">
              3ステップで、決裁者に届く手紙が完成します。
            </p>
          </div>

          <div className="flex flex-col gap-12 max-w-3xl mx-auto">
            {/* Step 1 */}
            <div className="relative flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg z-10 relative">
                1
              </div>
              {/* Connector Line */}
              <div className="absolute left-8 top-16 bottom-[-48px] w-0.5 bg-stone-200 hidden md:block"></div>

              <div className="pt-2 space-y-4 flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-800/10 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-800" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900">
                    企業URLを入力
                  </h3>
                </div>
                <p className="text-stone-600 leading-relaxed text-lg">
                  送りたい企業のホームページURLを入力するだけ。AIが自動的に事業内容や課題を収集します。<br />
                  <span className="text-amber-800 font-medium">イベント集客の場合は、イベントページのURLを入れるだけで招待状が完成します。</span>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg z-10 relative">
                2
              </div>
              {/* Connector Line */}
              <div className="absolute left-8 top-16 bottom-[-48px] w-0.5 bg-stone-200 hidden md:block"></div>

              <div className="pt-2 space-y-4 flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-800/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-800" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900">
                    AIが文面を生成
                  </h3>
                </div>
                <p className="text-stone-600 leading-relaxed text-lg">
                  相手の課題を分析し、独自の営業メソッドに基づいた説得力のある手紙を自動生成します。<br />
                  セールスレターだけでなく、<span className="text-amber-800 font-medium">展示会やセミナーの招待状</span>も、相手に合わせて最適化されます。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0 w-16 h-16 bg-amber-800 text-white rounded-full flex items-center justify-center text-2xl font-bold font-serif shadow-lg z-10 relative">
                3
              </div>

              <div className="pt-2 space-y-4 flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-800/10 rounded-lg flex items-center justify-center">
                    <Download className="w-6 h-6 text-amber-800" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900">
                    Wordで出力
                  </h3>
                </div>
                <p className="text-stone-600 leading-relaxed text-lg">
                  生成された手紙をWord形式でダウンロード。印刷して投函するだけです。
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link
              href="/new?demo=true"
              className="group inline-flex items-center justify-center gap-2 px-12 py-6 min-h-[44px] bg-amber-800 text-white rounded-lg font-bold text-xl hover:bg-amber-900 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            >
              いますぐレターを作成する（無料）
              <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-sm text-stone-400 font-medium">
              登録不要・企業URL入力だけ・クレカ不要
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases by Target */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              あなたの営業スタイルに合わせて
            </h2>
            <p className="text-xl text-stone-600">
              業種・規模を問わず、CxO向け営業の成果を最大化します。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Use Case 1: 営業代行 */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-8 border border-amber-200 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-amber-800/10 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-amber-800" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">営業代行会社</h3>
              <p className="text-stone-600 leading-relaxed mb-4">
                CSV一括生成で1日100通のレターを自動作成。外注費1通5,000円が、<span className="font-bold text-amber-800">月額9,800円で1,000通</span>に。
              </p>
              <ul className="space-y-2 text-sm text-stone-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  CSV一括生成で大量対応
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  企業ごとに個別最適化
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Word出力でそのまま納品
                </li>
              </ul>
              <p className="mt-4 text-sm font-semibold text-amber-800">Premium ¥9,800/月</p>
            </div>

            {/* Use Case 2: ISチーム */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-800/10 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-blue-800" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">インサイドセールスチーム</h3>
              <p className="text-stone-600 leading-relaxed mb-4">
                チーム全員のレター品質を標準化。<span className="font-bold text-blue-800">共有テンプレート</span>で属人化を解消し、ABMキャンペーンを加速。
              </p>
              <ul className="space-y-2 text-sm text-stone-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  チーム共有テンプレート
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  メンバー管理（最大20席）
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  チーム利用状況を可視化
                </li>
              </ul>
              <p className="mt-4 text-sm font-semibold text-blue-800">Team ¥20,000/月〜</p>
            </div>

            {/* Use Case 3: 個人・フリーランス */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-8 border border-emerald-200 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-emerald-800/10 rounded-xl flex items-center justify-center mb-6">
                <FileText className="w-7 h-7 text-emerald-800" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">フリーランス・個人営業</h3>
              <p className="text-stone-600 leading-relaxed mb-4">
                <span className="font-bold text-emerald-800">月額1,980円</span>で高品質なレターを無制限生成。品質スコア付きで「使えるレター」を確実に。
              </p>
              <ul className="space-y-2 text-sm text-stone-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  3バリエーション生成
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  AI品質スコアで品質保証
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  深層分析で差別化
                </li>
              </ul>
              <p className="mt-4 text-sm font-semibold text-emerald-800">Pro ¥1,980/月</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              こんな使い方ができます
            </h2>
            <p className="text-xl text-stone-600">
              CxO Letter Makerの活用イメージをご紹介します。
            </p>
            <p className="text-sm text-stone-400 mt-2">※ 以下は想定される活用シーンです。実際の成果は利用状況により異なります。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-stone-50 rounded-xl p-8 border border-stone-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-amber-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-stone-700 leading-relaxed mb-4">
                企業URLを入力するだけで、相手の事業内容に合わせた営業レターが30秒で完成。手作業で20分かかっていたリサーチと文面作成を大幅に効率化できます。
              </p>
              <p className="text-xs text-stone-400 mb-4">想定シーン: 月間30通程度の新規開拓レター作成</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-800 font-bold text-sm">
                  SaaS
                </div>
                <div>
                  <p className="font-semibold text-stone-900">SaaS企業の営業チーム</p>
                  <p className="text-sm text-stone-500">新規開拓・ABM施策</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-stone-50 rounded-xl p-8 border border-stone-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-amber-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-stone-700 leading-relaxed mb-4">
                CSV一括生成で数十社分のレターをまとめて作成。チーム全員が同じ品質のレターを送れるので、属人化の解消にも役立ちます。
              </p>
              <p className="text-xs text-stone-400 mb-4">想定シーン: 営業代行・チームでの大量アプローチ</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold text-sm">
                  BPO
                </div>
                <div>
                  <p className="font-semibold text-stone-900">営業代行・コンサルティング企業</p>
                  <p className="text-sm text-stone-500">チームでの一括活用</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-stone-50 rounded-xl p-8 border border-stone-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-amber-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-stone-700 leading-relaxed mb-4">
                営業リソースが限られていても、AIが企業分析からレター作成までを自動化。経営層向けの丁寧な手紙を、短時間で量産できます。
              </p>
              <p className="text-xs text-stone-400 mb-4">想定シーン: スタートアップの新規事業開発</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-800 font-bold text-sm">
                  Tech
                </div>
                <div>
                  <p className="font-semibold text-stone-900">スタートアップ・新規事業チーム</p>
                  <p className="text-sm text-stone-500">リソース効率化</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats — 検証可能な事実のみ表示 */}
          <div className="mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto">
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">30秒</p>
              <p className="text-stone-600 font-medium">平均作成時間</p>
            </div>
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">5</p>
              <p className="text-stone-600 font-medium">対応プラン数</p>
            </div>
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">100件</p>
              <p className="text-stone-600 font-medium">CSV一括生成/日</p>
              <p className="text-xs text-stone-400 mt-1">Proプラン</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              料金プラン
            </h2>
            <p className="text-xl text-stone-600">
              あなたのビジネスフェーズに合わせてお選びいただけます。
            </p>
          </div>

          <PricingTabs />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              よくあるご質問
            </h2>
            <p className="text-xl text-stone-600">
              CxO Letter Makerについて、よく寄せられる質問にお答えします。
            </p>
          </div>

          <div className="space-y-4">
            {/* FAQ 1 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">本当に無料で使えますか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                はい、無料プランをご用意しております。ただし、以下の制限がございます：<br /><br />
                <ul className="list-disc list-inside space-y-1 ml-2 text-stone-600">
                  <li>1日10回までの生成</li>
                  <li>履歴の閲覧は最新10件まで</li>
                  <li>テキストコピーが可能（Word形式ダウンロードはProプラン以上）</li>
                  <li>CSV一括生成はProプラン以上で利用可能</li>
                </ul>
                <br />
                より高品質なレターが必要な場合は、Proプランをご検討ください：
                <ul className="list-disc list-inside space-y-1 ml-2 text-stone-600 mt-2">
                  <li><strong>Proプラン（月額1,980円）</strong>: 深層分析、品質保証、3バリエーション、CSV一括生成100件/日</li>
                </ul>
              </div>
            </details>

            {/* FAQ 2 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">どのように使うのですか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                送りたい企業のホームページURLを入力し、必要な情報（自社名、サービス内容など）を入力するだけです。AIが企業情報を自動解析し、個別最適化されたレターを30秒で生成します。
              </div>
            </details>

            {/* FAQ 3 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">アカウント登録は必要ですか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                登録なしでもご利用いただけます。ただし、過去に作成したレターの履歴を保存したい場合は、無料アカウント登録をおすすめします。
              </div>
            </details>

            {/* FAQ 4 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">生成されたレターはどのような形式でダウンロードできますか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                Word（.docx）形式でダウンロード可能です。そのまま印刷して投函できる形式になっています。<br />
                <span className="text-sm text-stone-500">※ 現在、PDF形式でのダウンロードには対応しておりません。</span>
              </div>
            </details>

            {/* FAQ 5 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">入力した情報はAIの学習に使われますか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                <strong>いいえ、一切使用されません。</strong>入力データおよび生成されたコンテンツは、AIモデルの学習には使用しない契約を結んでいます。あなたのビジネス情報は厳重に保護されます。
              </div>
            </details>

            {/* FAQ Security New */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">アップロードした顧客リストや生成データは安全ですか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                はい、万全の対策を行っております。データは高度な暗号化技術を用いて保存され、<strong>お客様ご本人以外からは一切アクセスできない仕組み（RLS）</strong>を採用しています。また、生成AI（Google Gemini）に送信されるデータは生成目的のみに使用され、<strong>AIの学習データとして二次利用されることはありません。</strong>
              </div>
            </details>

            {/* FAQ 6 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">生成されたレターは編集できますか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                はい、生成されたレターはプレビュー画面で直接編集できます。また、Word形式でダウンロード後に自由に編集することも可能です。
              </div>
            </details>

            {/* FAQ 7 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">AIの分析精度はどのくらいですか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                最新のAI技術を使用し、企業のWebサイトから事業内容、課題、ニーズを高精度で分析します。BtoB営業の専門家が監修したメソッドに基づいているため、実務で即使えるレベルの品質を実現しています。
              </div>
            </details>

            {/* FAQ 8 */}
            <details className="group bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
              <summary className="cursor-pointer px-6 py-5 font-semibold text-stone-900 flex items-center justify-between">
                <span className="text-lg">何通まで生成できますか？</span>
                <svg className="w-5 h-5 text-stone-600 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-stone-700 leading-relaxed">
                プランごとに生成可能な件数が異なります：<br /><br />
                <ul className="list-disc list-inside space-y-1 ml-2 text-stone-600">
                  <li><strong>無料プラン</strong>: 1日10通まで（個別生成のみ）</li>
                  <li><strong>Proプラン（月額1,980円）</strong>: 個別生成無制限 + 深層分析 + 品質保証 + CSV一括生成100件/日</li>
                </ul>
              </div>
            </details>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="text-stone-600 mb-6">
              その他ご不明な点がございましたら、お気軽にお問い合わせください。
            </p>
            <Link
              href="/new?demo=true"
              className="inline-flex items-center gap-2 px-8 py-3 min-h-[44px] bg-amber-800 text-white rounded-md font-bold hover:bg-amber-900 transition-all shadow-lg hover:shadow-xl"
            >
              いますぐレターを作成する（無料）
              <Mail className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="pt-16 pb-24 md:pt-20 md:pb-32 bg-gradient-to-b from-amber-50/30 to-stone-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-stone-900 mb-6 leading-tight">
            アポ率の大幅改善を実現する手紙を、今すぐ無料で作成できます。
          </h2>
          <p className="text-xl text-stone-600 mb-12 leading-relaxed">
            登録不要、クレジットカード不要。<br className="md:hidden" />URLを入力するだけで、30秒後には本格的なレターが完成します。
          </p>

          <Link
            href="/new?demo=true"
            className="group inline-flex items-center justify-center gap-3 px-14 py-6 min-h-[44px] bg-amber-800 text-white rounded-lg font-bold text-xl hover:bg-amber-900 transition-all shadow-2xl hover:shadow-xl hover:scale-105"
          >
            いますぐレターを作成する（無料）
            <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-sm text-stone-400 mt-4">
            登録不要・企業URL入力だけ・クレカ不要
          </p>

          <div className="mt-12 pt-12 border-t border-stone-200">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-base font-medium text-stone-700">登録不要</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-base font-medium text-stone-700">クレジットカード不要</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-base font-medium text-stone-700">基本機能は無料</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* ブランド */}
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-2">CxO Letter Maker</h3>
              <p className="text-sm text-stone-600">決裁者に届く、本気の手紙。</p>
            </div>

            {/* リンク */}
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">サービス</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/new" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    手紙を作成
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    ログイン
                  </Link>
                </li>
                <li>
                  <a href="https://forms.gle/eRc3L6aGr65b5CVM8" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    お問い合わせ
                  </a>
                </li>
              </ul>
            </div>

            {/* 法務 */}
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">法的情報</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    プライバシーポリシー
                  </Link>
                </li>
                <li>
                  <Link href="/tokusho" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    特定商取引法に基づく表記
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* コピーライト */}
          <div className="border-t border-stone-200 pt-8 text-center">
            <p className="text-sm text-stone-500">
              © 2025 CxO Letter Maker. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
