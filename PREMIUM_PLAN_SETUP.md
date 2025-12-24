# Premium プラン設定ガイド

## 実装完了内容

### ✅ ステップ1: Agency機能の削除
- `src/app/agency` ディレクトリを完全削除
- `supabase/migrations/agency_mode.sql` を削除
- 関連する参照箇所も修正済み

### ✅ ステップ2: プラン設定の定数化
- `src/config/subscriptionPlans.ts` を作成
- Free, Pro, Premium の3プランを定義
- 既存コードのハードコーディングされた制限値を定数参照に変更

#### 更新されたファイル
1. `src/hooks/useUserPlan.ts` - Premium プラン対応、`isPremium` プロパティ追加
2. `src/lib/subscription.ts` - `isPremium` の判定ロジック追加
3. `src/lib/supabaseHistoryUtils.ts` - `FREE_HISTORY_LIMIT` を定数参照
4. `src/app/api/batch-generate/route.ts` - `MAX_BATCH_SIZE_PER_REQUEST` を定数参照

---

## 🚀 次のステップ: Stripe設定

Premium プランを有効化するには、以下の手順でStripe商品を作成してください。

### 1. Stripe Dashboardで商品作成

#### Pro プラン（既存の確認）
```
商品名: CxO Letter Maker - Pro
価格: ¥2,980 / 月（月次サブスクリプション）
```

#### Premium プラン（新規作成）
```
商品名: CxO Letter Maker - Premium
価格: ¥9,800 / 月（月次サブスクリプション）
説明: 大規模営業活動向けプラン - CSV一括生成 1000件/日
```

### 2. 環境変数の設定

`.env.local` に以下を追加：

```bash
# 既存
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_xxxxxxxxxxxxx

# 新規追加
NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM=price_xxxxxxxxxxxxx
```

**注意**: `price_xxxxxxxxxxxxx` は実際のStripe Price IDに置き換えてください。

### 3. チェックアウトページの更新

`src/app/checkout/page.tsx` などのチェックアウトページに、Premiumプランの選択肢を追加してください。

例：
```typescript
import { PLANS, getPlan, getFormattedPrice } from '@/config/subscriptionPlans';

// プラン選択UI
{PLAN_NAMES.map((planType) => {
  const plan = getPlan(planType);
  return (
    <PlanCard
      key={planType}
      title={plan.label}
      price={getFormattedPrice(planType)}
      features={plan.features}
      stripePriceId={plan.stripePriceId}
    />
  );
})}
```

### 4. Supabase Database更新

`profiles` テーブルの `plan` カラムが `premium` 値を受け入れるように確認してください。

```sql
-- 既存のカラム定義を確認
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'plan';

-- 必要に応じて制約を更新（通常はtext型なので変更不要）
```

---

## 📊 プラン比較

| プラン | 月額料金 | CSV一括生成 | 個別生成 | 履歴保存 |
|--------|---------|------------|----------|----------|
| **Free** | 無料 | 不可 | 無制限 | 最新10件 |
| **Pro** | ¥2,980 | 100件/日 | 無制限 | 無制限 |
| **Premium** | ¥9,800 | 1,000件/日 | 無制限 | 無制限 |

---

## 🧪 テスト手順

### 1. ローカル環境でのテスト

```bash
npm run dev
```

### 2. Premiumプランの動作確認

1. Supabase Dashboardで、テストユーザーの `plan` を `premium` に変更
2. ログインして、CSV一括生成の制限が1000件/日になっていることを確認
3. `useUserPlan()` フックで `isPremium` が `true` を返すことを確認

### 3. TypeScriptエラーチェック

```bash
npm run build
```

**✅ ビルド成功を確認済み**

---

## 📝 今後のメンテナンス

プランの制限値や価格を変更する際は、**`src/config/subscriptionPlans.ts`** のみを編集してください。

### 例: Pro プランの日次制限を150件に変更

```typescript
// src/config/subscriptionPlans.ts
export const PLANS: Record<PlanType, PlanConfig> = {
  // ...
  pro: {
    label: 'Pro',
    dailyBatchLimit: 150, // 100 → 150 に変更
    price: 2980,
    // ...
  },
  // ...
}
```

この変更により、アプリ全体で自動的に新しい制限値が適用されます。

---

## 🔒 セキュリティチェック

- [x] Agency関連の削除により、不要な管理機能が公開されていないことを確認
- [x] プラン定義がサーバーサイドで適切にチェックされている
- [x] 環境変数（Stripe Price ID）が適切に保護されている

---

## ✨ 完了

すべての実装とリファクタリングが完了しました。
Stripe商品を作成し、環境変数を設定すれば、Premiumプランが有効化されます。
