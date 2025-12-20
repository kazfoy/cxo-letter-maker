import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* ヘッダー */}
        <div className="mb-12">
          <Link href="/" className="inline-block text-stone-600 hover:text-stone-900 mb-6 transition-colors">
            ← トップページに戻る
          </Link>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
            利用規約
          </h1>
          <p className="text-stone-600">最終更新日: 2025年1月1日</p>
        </div>

        {/* 本文 */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第1条（適用範囲）</h2>
            <p className="text-stone-700 leading-relaxed">
              本規約は、CxO Letter Maker（以下「本サービス」といいます）の利用に関し、本サービス提供者と利用者との間の権利義務関係を定めることを目的とし、本サービスの利用に関わる一切の関係に適用されます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第2条（定義）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本規約において使用する用語の定義は、以下のとおりとします。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>「本サービス」とは、CxO Letter Makerが提供する営業レター作成支援サービスをいいます。</li>
              <li>「利用者」とは、本サービスを利用する個人または法人をいいます。</li>
              <li>「生成コンテンツ」とは、本サービスを通じて生成されたレター文面をいいます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第3条（利用登録）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              利用希望者は、本規約を遵守することに同意し、本サービスの定める方法により利用登録を申請するものとします。
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、前項の申請を審査し、これを承認する場合には、利用希望者に対し、その旨を通知します。利用希望者は、本サービスから承認の通知を受けた時点で利用者となります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第4条（アカウント管理）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              利用者は、自己の責任において、本サービスに関するアカウント情報を管理するものとします。
            </p>
            <p className="text-stone-700 leading-relaxed">
              利用者は、アカウント情報が第三者に使用されたことにより被った損害について、本サービスに故意または重過失がある場合を除き、本サービスは一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第5条（禁止事項）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスの運営を妨害するおそれのある行為</li>
              <li>他の利用者または第三者の知的財産権を侵害する行為</li>
              <li>他の利用者または第三者の名誉、信用、プライバシー等を侵害する行為</li>
              <li>虚偽の情報を登録する行為</li>
              <li>本サービスのネットワークまたはシステム等に過度な負荷をかける行為</li>
              <li>本サービスの提供を妨害する行為</li>
              <li>その他、本サービスが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第6条（生成コンテンツの取扱い）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              <strong className="text-stone-900">生成コンテンツの著作権は、利用者に帰属します。</strong>本サービスは、生成コンテンツに対していかなる権利も主張しません。
            </p>
            <p className="text-stone-700 leading-relaxed mb-4">
              利用者は、生成コンテンツを自己の責任において利用するものとし、生成コンテンツの利用により生じた一切の責任を負うものとします。
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、生成コンテンツの正確性、完全性、有用性等について、いかなる保証も行いません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第7条（サービスの変更・中断・終了）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、利用者への事前の通知なく、本サービスの内容を変更し、または提供を中断もしくは終了することができるものとします。
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、本条に基づき本サービスの内容の変更、中断または終了により利用者に生じた損害について、一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第8条（免責事項）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを保証しません。
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、本サービスに起因して利用者に生じた損害について、一切の責任を負いません。ただし、本サービスに故意または重過失がある場合はこの限りではありません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">第9条（準拠法・管轄裁判所）</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本規約の解釈にあたっては、日本法を準拠法とします。
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスに関して紛争が生じた場合には、本サービスの所在地を管轄する裁判所を専属的合意管轄裁判所とします。
            </p>
          </section>

          <section className="pt-8 border-t border-stone-200">
            <p className="text-stone-600 text-sm">
              本規約に関するお問い合わせは、本サービスのお問い合わせフォームよりご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
