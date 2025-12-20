import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* ヘッダー */}
        <div className="mb-12">
          <Link href="/" className="inline-block text-stone-600 hover:text-stone-900 mb-6 transition-colors">
            ← トップページに戻る
          </Link>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
            プライバシーポリシー
          </h1>
          <p className="text-stone-600">最終更新日: 2025年1月1日</p>
        </div>

        {/* 本文 */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 md:p-12 space-y-8">
          <section>
            <p className="text-stone-700 leading-relaxed">
              CxO Letter Maker（以下「本サービス」といいます）は、利用者のプライバシーを尊重し、個人情報の保護に努めます。本プライバシーポリシーは、本サービスが利用者の個人情報をどのように収集、利用、管理するかを説明するものです。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">1. 収集する情報</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、以下の情報を収集します。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li><strong>アカウント情報:</strong> メールアドレス、パスワード（暗号化して保存）</li>
              <li><strong>入力データ:</strong> 企業名、担当者名、レター内容に関する入力情報</li>
              <li><strong>生成コンテンツ:</strong> 本サービスを通じて生成されたレター文面</li>
              <li><strong>利用履歴:</strong> 本サービスの利用状況、アクセスログ</li>
              <li><strong>技術情報:</strong> IPアドレス、ブラウザ情報、デバイス情報</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">2. 情報の利用目的</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              収集した情報は、以下の目的で利用します。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>本サービスの提供、運営、改善</li>
              <li>利用者からのお問い合わせへの対応</li>
              <li>本サービスの利用状況の分析</li>
              <li>不正利用の防止</li>
              <li>本サービスに関する重要なお知らせの送信</li>
            </ul>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">3. AIモデルの学習について</h2>
            <p className="text-stone-900 leading-relaxed mb-4 font-semibold">
              <strong className="text-amber-800">重要:</strong> 本サービスで入力されたデータ（企業名、担当者名、レター内容など）および生成されたコンテンツは、<strong className="underline">AIモデルの学習には一切使用されません。</strong>
            </p>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、外部のAI API（Google Gemini APIなど）を利用していますが、これらのAPIプロバイダーとの契約において、以下を確保しています：
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>入力データはAIモデルの学習に使用されない</li>
              <li>生成されたコンテンツはAIモデルの学習に使用されない</li>
              <li>処理後のデータは適切に削除される</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-4">
              利用者のビジネス情報は厳重に保護され、第三者のAI学習に利用されることはありません。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">4. 生成コンテンツの著作権</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              <strong className="text-stone-900">本サービスを通じて生成されたレター文面の著作権は、利用者に帰属します。</strong>
            </p>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、生成コンテンツに対していかなる権利も主張せず、利用者は生成コンテンツを自由に利用、修正、配布することができます。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">5. 情報の共有と開示</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、以下の場合を除き、利用者の個人情報を第三者に開示または共有しません。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>利用者の同意がある場合</li>
              <li>法令に基づく開示が必要な場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合</li>
              <li>本サービスの権利、財産またはサービスを保護するために必要な場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">6. 情報のセキュリティ</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、利用者の個人情報を適切に管理し、以下のセキュリティ対策を実施しています。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>SSL/TLS暗号化通信による安全なデータ送信</li>
              <li>パスワードの暗号化保存</li>
              <li>アクセス制御による不正アクセス防止</li>
              <li>定期的なセキュリティ監査</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">7. Cookieの使用</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              本サービスは、ユーザー体験の向上のためにCookieを使用します。Cookieは、以下の目的で使用されます。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>ログイン状態の維持</li>
              <li>サービス利用状況の分析</li>
              <li>ユーザー設定の保存</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-4">
              利用者は、ブラウザの設定によりCookieを無効にすることができますが、一部の機能が正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">8. 利用者の権利</h2>
            <p className="text-stone-700 leading-relaxed mb-4">
              利用者は、自己の個人情報について、以下の権利を有します。
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700">
              <li>個人情報の開示、訂正、削除を請求する権利</li>
              <li>個人情報の利用停止を請求する権利</li>
              <li>アカウントの削除を請求する権利</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-4">
              これらの権利を行使する場合は、本サービスのお問い合わせフォームよりご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">9. プライバシーポリシーの変更</h2>
            <p className="text-stone-700 leading-relaxed">
              本サービスは、必要に応じて本プライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">10. お問い合わせ</h2>
            <p className="text-stone-700 leading-relaxed">
              本プライバシーポリシーに関するお問い合わせは、本サービスのお問い合わせフォームよりご連絡ください。
            </p>
          </section>

          <section className="pt-8 border-t border-stone-200">
            <p className="text-stone-600 text-sm">
              本プライバシーポリシーは、利用者の個人情報を適切に保護し、安心してサービスをご利用いただくために定めたものです。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
