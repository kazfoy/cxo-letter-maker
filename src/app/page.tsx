'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Mail, Target, Zap, FileText, Download, Sparkles, X } from 'lucide-react';

const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 100);
    return () => clearInterval(intervalId);
  }, [text]);

  return (
    <span className="inline-block">
      {displayText}
      <span className="animate-blink border-r-2 border-stone-900 ml-1">&nbsp;</span>
    </span>
  );
};

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // ログイン済みユーザーは自動的に /dashboard へリダイレクト


  return (
    <div className="min-h-screen bg-stone-50">
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
                  累計生成数 1,000通突破
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-black text-stone-900 leading-tight tracking-tight">
                決裁者への<br className="md:hidden" />アポ率を<span className="text-amber-800">3倍</span>にする。
              </h1>

              <p className="text-2xl md:text-3xl font-serif text-stone-700 leading-relaxed min-h-[1.5em]">
                <TypewriterText text="AIが書く、本気の手紙。" />
              </p>

              <p className="text-lg text-stone-600 leading-relaxed">
                URLを入れるだけ。独自の営業メソッドに基づいた個別最適化レターを、30秒で。<br />
                営業レターだけでなく、イベント集客の招待状も作成可能。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-stone-900 text-stone-50 rounded-md font-semibold text-lg hover:bg-stone-800 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  無料で今すぐ始める
                  <Mail className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-stone-900 border-2 border-stone-200 rounded-md font-medium text-lg hover:bg-stone-50 transition-all"
                >
                  ログイン
                </Link>
              </div>
              <p className="text-sm text-stone-500 pt-2">
                ※ クレジットカード不要・登録不要ですぐに使えます
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
                      <span className="text-amber-800 font-bold text-lg">完全無料</span>
                      <p className="text-xs text-stone-500 mt-1">※ 今後、有料機能を実装予定</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-lg text-stone-700 font-medium mb-6">
              アポ率を上げながら、作業時間を<span className="text-amber-800 font-bold">40分の1</span>に短縮できます。
            </p>
            <Link
              href="/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-stone-900 text-white rounded-md font-semibold hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl"
            >
              今すぐ体験する
              <Mail className="w-5 h-5" />
            </Link>
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
              href="/new"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 px-12 py-6 bg-amber-800 text-white rounded-lg font-bold text-xl hover:bg-amber-900 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            >
              30秒で手紙を作成してみる（無料）
              <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-4 text-base text-stone-600 font-medium">
              登録不要・クレジットカード不要ですぐに使えます
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              導入企業の声
            </h2>
            <p className="text-xl text-stone-600">
              多くの営業担当者が、成果を実感しています。
            </p>
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
              <p className="text-stone-700 leading-relaxed mb-6">
                「これまで1通20分かけていたレター作成が30秒で完了。しかも相手企業の情報を自動で分析してくれるので、質も向上しました。アポ率が2.5倍になったのは驚きです。」
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">T.K. 様</p>
                  <p className="text-sm text-stone-600">SaaS企業・営業マネージャー</p>
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
              <p className="text-stone-700 leading-relaxed mb-6">
                「小規模チームで大手企業へのアプローチに苦戦していましたが、このツールのおかげで個別最適化されたレターを量産できるようになりました。決裁者からの返信率が劇的に向上しています。」
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">M.S. 様</p>
                  <p className="text-sm text-stone-600">コンサルティング企業・代表取締役</p>
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
              <p className="text-stone-700 leading-relaxed mb-6">
                「新規事業の立ち上げで、限られたリソースの中で最大限の成果を出す必要がありました。このツールで営業効率が格段に上がり、3ヶ月で50社以上の決裁者とのアポイントを獲得できました。」
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-stone-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-stone-900">T.Y. 様</p>
                  <p className="text-sm text-stone-600">スタートアップ・事業開発責任者</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">3倍</p>
              <p className="text-stone-600 font-medium">平均アポ獲得率</p>
            </div>
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">30秒</p>
              <p className="text-stone-600 font-medium">平均作成時間</p>
            </div>
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">1,000+</p>
              <p className="text-stone-600 font-medium">累計生成レター数</p>
            </div>
            <div className="text-center group">
              <p className="text-4xl md:text-5xl font-serif font-bold text-amber-800 mb-2 transition-transform group-hover:scale-110">95%</p>
              <p className="text-stone-600 font-medium">ユーザー満足度</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-6">
              料金プラン
            </h2>
            <p className="text-xl text-stone-600">
              あなたのビジネスフェーズに合わせてお選びいただけます。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="bg-stone-50 rounded-2xl p-8 border border-stone-200 shadow-sm flex flex-col">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-stone-900 mb-2">Free Plan</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-stone-900">0</span>
                  <span className="text-stone-600 font-medium">円 / 月</span>
                </div>
                <p className="text-stone-600 mt-4 text-sm mb-6">
                  まずはお試しで使ってみたい方に
                </p>
                <Link
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 bg-white border-2 border-stone-200 text-stone-900 font-bold text-center rounded-lg hover:bg-stone-50 transition-colors"
                >
                  無料で始める
                </Link>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-smfont-bold text-stone-900">主な機能:</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-stone-700">
                    <svg className="w-5 h-5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>1日10回まで生成可能</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-700">
                    <svg className="w-5 h-5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>最新10件の履歴保存</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-700">
                    <svg className="w-5 h-5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>AIによる企業分析 & 生成</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-400">
                    <X className="w-5 h-5 flex-shrink-0" />
                    <span>Word形式ダウンロード (不可)</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-400">
                    <X className="w-5 h-5 flex-shrink-0" />
                    <span>CSV一括生成 (不可)</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-amber-800 shadow-xl relative flex flex-col transform md:-translate-y-4">
              <div className="absolute top-0 right-0 bg-amber-800 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                RECOMMENDED
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-amber-800 mb-2">Pro Plan</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-stone-900">980</span>
                  <span className="text-stone-600 font-medium">円 / 月 (税込)</span>
                </div>
                <p className="text-stone-600 mt-4 text-sm mb-6">
                  本格的に営業成果を上げたい方に
                </p>
                <Link
                  href="/login?redirect=/checkout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 bg-gradient-to-r from-amber-700 to-amber-900 text-white font-bold text-center rounded-lg hover:from-amber-800 hover:to-amber-950 transition-all shadow-md transform hover:scale-[1.02]"
                >
                  Proプランで始める
                </Link>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-stone-900">Freeプランの全機能に加え:</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-stone-900 font-medium">
                    <div className="bg-amber-100 rounded-full p-1">
                      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>無制限に生成可能</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-900 font-medium">
                    <div className="bg-amber-100 rounded-full p-1">
                      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>全履歴の無期限保存</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-900 font-medium">
                    <div className="bg-amber-100 rounded-full p-1">
                      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Word形式ダウンロード</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-900 font-medium">
                    <div className="bg-amber-100 rounded-full p-1">
                      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-amber-800 font-bold">CSV一括生成機能</span>
                  </li>
                  <li className="flex items-start gap-3 text-stone-900 font-medium">
                    <div className="bg-amber-100 rounded-full p-1">
                      <svg className="w-3 h-3 text-amber-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>優先メールサポート</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
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
                  <li>Word形式でのダウンロードは不可（テキストコピーは可能）</li>
                  <li>CSV一括生成機能は利用不可</li>
                </ul>
                <br />
                より高度な機能が必要な場合は、月額980円のProプランをご検討ください。
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
                無料プランでは、1日10通まで生成いただけます。<br />
                Proプラン（月額980円）にご加入いただくと、無制限で生成可能になります。
              </div>
            </details>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="text-stone-600 mb-6">
              その他ご不明な点がございましたら、お気軽にお問い合わせください。
            </p>
            <Link
              href="/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-amber-800 text-white rounded-md font-semibold hover:bg-amber-900 transition-all shadow-lg hover:shadow-xl"
            >
              今すぐ無料で試してみる
              <Mail className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="pt-16 pb-24 md:pt-20 md:pb-32 bg-gradient-to-b from-amber-50/30 to-stone-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-stone-900 mb-6 leading-tight">
            アポ率を3倍にする手紙を、今すぐ無料で作成できます。
          </h2>
          <p className="text-xl text-stone-600 mb-12 leading-relaxed">
            登録不要、クレジットカード不要。<br className="md:hidden" />URLを入力するだけで、30秒後には本格的なレターが完成します。
          </p>

          <Link
            href="/new"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-3 px-12 py-6 bg-stone-900 text-white rounded-lg font-bold text-xl hover:bg-stone-800 transition-all shadow-2xl hover:shadow-xl hover:scale-105"
          >
            今すぐ無料で始める
            <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>

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
                <span className="text-base font-medium text-stone-700">すべての機能が無料</span>
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
                  <Link href="/new" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    手紙を作成
                  </Link>
                </li>
                <li>
                  <Link href="/login" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    ログイン
                  </Link>
                </li>
              </ul>
            </div>

            {/* 法務 */}
            <div>
              <h4 className="text-sm font-semibold text-stone-900 mb-3">法的情報</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    プライバシーポリシー
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
