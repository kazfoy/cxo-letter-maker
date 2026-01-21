# Phase 5 品質テストレポート

実行日時: 2026-01-09T15:23:55.790Z

## ローカル品質ゲートテスト

- ✅ 良いレター: PASS (score: 80)
- ✅ 禁止ワードレター: PASS (correctly rejected, score: 30)
- ✅ 短すぎるレター: PASS (correctly rejected for length)
- ✅ Draftプレースホルダー: PASS (correctly handled by mode)

**結果**: 4 passed / 0 failed

## テストケース一覧

1. **URLのみ（上場企業）**: ターゲット企業のURLのみを指定した基本ケース
2. **URLのみ（情報少なめ）**: 情報が少ないWebページからの分析
3. **user_notesのみ**: ユーザーメモのみからの分析
4. **PDFあり**: PDF抽出テキストを含むケース
5. **欠損だらけ Draft**: 情報がほとんどない状態でのDraftモード
6. **sender薄い**: 送り手情報が最小限のケース
7. **proof_pointsあり**: 具体的な数値実績を含むケース
8. **newsあり**: 最新ニュース情報を含むケース
9. **recipient欠落**: 宛先情報が不足しているケース
10. **日英混在メモ**: 日本語と英語が混在した入力

## API統合テストについて

APIエンドポイント:
- `POST /api/analyze-input`: 入力分析
- `POST /api/generate-v2`: レター生成（v2）

統合テストを実行するには:
```bash
BASE_URL=http://localhost:3000 npx tsx scripts/test-quality.ts --integration
```

## 品質基準

### qualityGate ルール
1. 文字数: 250-650文字
2. 禁止ワード: 「業務効率化」「コスト削減」「感銘を受け」等
3. プレースホルダー: Completeモードでは禁止
4. 証拠ポイント: 数値がある場合はproof_points必須
5. ニュース断定: recent_newsがない場合は断定禁止

### 品質スコア (100点満点)
- 文字数: 20点
- CxO視座: 20点
- 具体性: 20点
- 構成: 20点
- プレースホルダー: 20点（Completeのみ）

80点以上で合格、80点未満は再生成
