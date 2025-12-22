# Stripe Setup Guide

このプロジェクトでStripe決済機能を使用するためのセットアップ手順です。

## 1. Stripeアカウントの作成とAPIキーの取得

1. [Stripeの公式サイト](https://stripe.com/jp)にアクセスし、アカウントを作成（またはログイン）します。
2. ダッシュボードの左上にある「開発者モード」トグルをオンにします（テスト環境を使用するため）。
3. 「開発者」→「APIキー」タブを開きます。
4. 以下のキーを取得し、`.env.local` に設定します。
   - **公開可能キー**: `pk_test_...` -> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **シークレットキー**: `sk_test_...` -> `STRIPE_SECRET_KEY`

## 2. 商品と価格の登録

サブスクリプションプラン（Proプラン）を作成します。

1. ダッシュボードの「商品」→「商品をより多く追加」をクリックします。
2. 以下の情報を入力します：
   - **名前**: Pro Plan (または任意の名称)
   - **説明**: 月額サブスクリプション
   - **画像**: (任意)
3. 「価格情報」を設定します：
   - **価格モデル**: 標準の価格設定
   - **価格**: 1000 (例: 1000円)
   - **通貨**: JPY
   - **請求期間**: 毎月
4. 「商品を保存」をクリックします。
5. 作成された商品の詳細ページで、「価格API ID」 (`price_...` で始まるID) をコピーします。
6. `.env.local` に設定します。
   - `STRIPE_PRICE_ID_PRO_MONTHLY=price_...`

## 3. Webhookのセットアップ (ローカル開発用)

Stripe CLIを使用して、ローカル環境へのWebhookイベントを転送します。

1. [Stripe CLI](https://stripe.com/docs/stripe-cli) をインストールします（未インストールの場合）。
   - macOS (Homebrew): `brew install stripe/stripe-cli/stripe`
2. ターミナルでログインします：
   ```bash
   stripe login
   ```
3. Webhookイベントのリッスンを開始します：
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. コマンド出力に表示される `Webhook signing secret` (`whsec_...` で始まるキー) をコピーします。
5. `.env.local` に設定します。
   - `STRIPE_WEBHOOK_SECRET=whsec_...`

## 4. 環境変数の確認

`.env.local` ファイルが正しく設定されているか確認してください。

```bash
# .env.local example

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 5. 動作確認

サーバーを再起動して、環境変数を読み込ませてください。

```bash
npm run dev
```
