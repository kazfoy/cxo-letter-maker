# CxO Letter Maker

CxO（経営層）向け営業手紙作成ツールです。AIが決裁者に「会いたい」と思わせる効果的なセールスレターをドラフトします。

## 特徴

- **効果的な構成**: 5要素（背景・フック、課題の指摘、解決策、実績、オファー）を厳守
- **低コスト運用**: Gemini 1.5 Flash 使用で1通あたり約0.08円
- **品質改善機能**: Gemini 1.5 Pro による高品質な文章生成（1通あたり約1.4円）
- **自動編集**: カジュアル化、事例強調、短縮などワンクリックで調整
- **履歴機能**: ブラウザ内に最大50件まで保存（LocalStorage使用）
- **Word出力**: .docx形式でダウンロード可能

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Gemini APIキーの設定

1. [Google AI Studio](https://aistudio.google.com/app/apikey) でAPIキーを取得
2. プロジェクトルートに `.env.local` ファイルを作成
3. 以下の内容を記述

```env
GOOGLE_GEMINI_API_KEY=あなたのAPIキー
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 使い方

### 基本的な流れ

1. **ターゲット情報を入力**
   - 企業名、役職、氏名を入力

2. **5つの構成要素を入力**
   - 背景・フック: なぜ今、その企業なのか
   - 課題の指摘: 業界特有の課題や成長企業の壁
   - 解決策の提示: 自社ソリューションのアプローチ
   - 事例・実績: 同業他社や類似企業での成果
   - オファー: 具体的なアクション（面談依頼など）

3. **「手紙を生成」をクリック**
   - Gemini 1.5 Flash が約0.08円で生成

4. **必要に応じて編集・調整**
   - プレビューエリアで直接編集
   - 「カジュアルに」「事例を強調」「もっと短く」ボタンで自動調整
   - 「品質改善 (Pro)」ボタンで Gemini 1.5 Pro による高品質化

5. **出力**
   - 「コピー」: クリップボードにコピー
   - 「Word出力」: .docx形式でダウンロード

### 履歴機能

- 右下の「履歴」ボタンから過去の作成履歴を確認
- 「復元」で過去の入力内容と生成結果を呼び出し
- 最大50件まで保存（それ以上は古いものから削除）
- ⚠️ iOS Safariでは7日間でLocalStorageがクリアされる場合があります

## コスト目安

| モデル | 用途 | 1通あたり |
|--------|------|----------|
| Gemini 1.5 Flash | 標準生成・自動編集 | 約0.08円 |
| Gemini 1.5 Pro | 品質改善 | 約1.4円 |

※ 為替レート: 1ドル=150円で計算

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API (@google/generative-ai)
- **Document**: docx (Word出力)
- **Storage**: LocalStorage (ブラウザ内保存)

## セキュリティ

- APIキーは `.env.local` で管理（Gitにコミットされません）
- XSS対策: Reactの標準エスケープを使用
- 入力バリデーション: 各項目500文字制限
- LocalStorage使用: 機密情報は保存しない前提

## デプロイ

### Vercel推奨

```bash
# Vercel CLIをインストール
npm i -g vercel

# デプロイ
vercel

# 環境変数を設定
vercel env add GOOGLE_GEMINI_API_KEY
```

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesでお知らせください。
