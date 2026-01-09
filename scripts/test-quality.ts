/**
 * Phase 5 品質テストスクリプト
 *
 * 使用方法:
 * 1. 開発サーバーを起動: npm run dev
 * 2. スクリプトを実行: BASE_URL=http://localhost:3000 npx tsx scripts/test-quality.ts
 */

import { validateLetterOutput, calculateQualityScore, type ProofPoint } from '../src/lib/qualityGate';
import * as fs from 'fs';

// テストケース定義
interface TestCase {
  name: string;
  description: string;
  analyzeInput: {
    target_url?: string;
    pdf_text?: string;
    user_notes?: string;
    sender_info?: {
      company_name: string;
      service_description: string;
    };
  };
  generateInput: {
    mode: 'draft' | 'complete';
    output_format: 'letter' | 'email';
  };
}

const TEST_CASES: TestCase[] = [
  {
    name: 'URLのみ（上場企業）',
    description: 'ターゲット企業のURLのみを指定した基本ケース',
    analyzeInput: {
      target_url: 'https://www.toyota.co.jp/jpn/company/',
      sender_info: {
        company_name: '株式会社テストサービス',
        service_description: 'AIを活用した業務効率化ソリューション',
      },
    },
    generateInput: { mode: 'complete', output_format: 'letter' },
  },
  {
    name: 'URLのみ（情報少なめ）',
    description: '情報が少ないWebページからの分析',
    analyzeInput: {
      target_url: 'https://example.com',
      sender_info: {
        company_name: '株式会社テストサービス',
        service_description: 'クラウド型会計システム',
      },
    },
    generateInput: { mode: 'draft', output_format: 'letter' },
  },
  {
    name: 'user_notesのみ',
    description: 'ユーザーメモのみからの分析',
    analyzeInput: {
      user_notes: `
        ターゲット企業: 株式会社ABC
        代表取締役: 山田太郎
        業界: 製造業
        従業員数: 500名
        課題: 内部統制の強化、監査対応の効率化
        最近のニュース: DX推進プロジェクト発足
      `,
      sender_info: {
        company_name: '株式会社ガバナンステック',
        service_description: '内部統制・監査支援クラウドサービス。導入企業では監査対応工数を平均50%削減。',
      },
    },
    generateInput: { mode: 'complete', output_format: 'letter' },
  },
  {
    name: 'PDFあり',
    description: 'PDF抽出テキストを含むケース',
    analyzeInput: {
      pdf_text: `
        有価証券報告書（抜粋）
        会社名: 株式会社XYZ
        代表者: 佐藤一郎 代表取締役社長
        事業内容: 金融サービス
        従業員数: 2,000名
        売上高: 500億円
        経営課題: デジタル化推進、コンプライアンス体制強化
      `,
      sender_info: {
        company_name: '株式会社フィンテックソリューション',
        service_description: '金融機関向けDXソリューション。コンプライアンス自動化で月間100時間の削減実績。',
      },
    },
    generateInput: { mode: 'complete', output_format: 'email' },
  },
  {
    name: '欠損だらけ Draft',
    description: '情報がほとんどない状態でのDraftモード',
    analyzeInput: {
      user_notes: '製造業の会社です',
    },
    generateInput: { mode: 'draft', output_format: 'letter' },
  },
  {
    name: 'sender薄い',
    description: '送り手情報が最小限のケース',
    analyzeInput: {
      user_notes: '株式会社DEF 取締役CFO 鈴木次郎様 金融業界',
      sender_info: {
        company_name: 'テスト会社',
        service_description: 'コンサルティング',
      },
    },
    generateInput: { mode: 'complete', output_format: 'letter' },
  },
  {
    name: 'proof_pointsあり',
    description: '具体的な数値実績を含むケース',
    analyzeInput: {
      user_notes: `
        株式会社GHI
        専務取締役 CFO 高橋三郎様
        業種: 小売業
        従業員: 3,000名

        最近の動向:
        - 前期決算で売上高1,200億円達成
        - 新規出店計画を発表（年間20店舗）
        - ESG経営への取り組み強化

        当社実績:
        - 同業J社様では在庫回転率を1.5倍に改善
        - K社様では経営ダッシュボード導入で意思決定スピード30%向上
      `,
      sender_info: {
        company_name: '株式会社リテールDX',
        service_description: '小売業向け経営ダッシュボード。リアルタイムKPI可視化で経営判断を加速。',
      },
    },
    generateInput: { mode: 'complete', output_format: 'letter' },
  },
  {
    name: 'newsあり',
    description: '最新ニュース情報を含むケース',
    analyzeInput: {
      user_notes: `
        ターゲット: 株式会社LMN
        代表取締役社長 渡辺四郎様
        業種: IT・ソフトウェア

        最新ニュース:
        - 先週発表されたIR資料によると、来期はM&Aによる成長戦略を推進予定
        - PMI（買収後統合）の課題が報道で取り上げられている
        - 2024年度IT投資額は前年比20%増の計画
      `,
      sender_info: {
        company_name: '株式会社PMIコンサルティング',
        service_description: 'M&A後のPMI支援サービス。シナジー実現率を平均30%向上させる統合支援メソッド。',
      },
    },
    generateInput: { mode: 'complete', output_format: 'letter' },
  },
  {
    name: 'recipient欠落',
    description: '宛先情報が不足しているケース',
    analyzeInput: {
      user_notes: '製造業の上場企業。最近DX推進を発表。',
      sender_info: {
        company_name: '株式会社製造DX',
        service_description: '製造業向けIoTプラットフォーム',
      },
    },
    generateInput: { mode: 'draft', output_format: 'letter' },
  },
  {
    name: '日英混在メモ',
    description: '日本語と英語が混在した入力',
    analyzeInput: {
      user_notes: `
        Target Company: 株式会社Global Tech
        CEO: John Tanaka (田中ジョン)
        Industry: Technology / SaaS
        Employees: 800+

        Recent News:
        - Series C fundingで50M USD調達完了
        - APAC expansion計画を発表
        - 新CTOにMicrosoft出身者を招聘

        Challenges:
        - Rapid scaling需要への対応
        - Governance体制の整備
      `,
      sender_info: {
        company_name: '株式会社エンタープライズセキュリティ',
        service_description: 'Zero Trust Securityソリューション。Fortune 500企業100社以上に導入実績。',
      },
    },
    generateInput: { mode: 'complete', output_format: 'email' },
  },
];

// ローカル品質検証テスト
function runLocalQualityTests(): { passed: number; failed: number; results: string[] } {
  console.log('\n========================================');
  console.log('ローカル品質ゲートテスト');
  console.log('========================================\n');

  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // テスト1: 良いレターのテスト
  const goodLetter = `株式会社サンプル
代表取締役社長 山田 太郎 様

貴社が先日発表されたDX推進計画において、グループ全体のガバナンス強化と経営スピード向上が重要課題ではないかと推察いたします。

同業界のB社様では、弊社のサービス導入により監査対応工数を50%削減し、連結決算期間を2週間短縮されました。また、内部統制の可視化によりリスク検知の精度が大幅に向上しています。

御社においても、ガバナンス体制の一元化による経営判断の迅速化と、コンプライアンスリスクの低減を実現できると考えております。

15分だけ、現状の課題感をお聞かせいただけないでしょうか。

株式会社テスト 営業部
鈴木 一郎`;

  const goodProofPoints: ProofPoint[] = [
    { type: 'numeric', content: '監査対応工数を50%削減', confidence: 'high' },
    { type: 'case_study', content: 'B社様での導入実績', confidence: 'high' },
  ];

  const goodResult = validateLetterOutput(goodLetter, goodProofPoints, { mode: 'complete', hasRecentNews: true });
  const goodScore = calculateQualityScore(goodLetter, goodProofPoints, 'complete');

  if (goodResult.ok && goodScore >= 80) {
    passed++;
    results.push(`✅ 良いレター: PASS (score: ${goodScore})`);
  } else {
    failed++;
    results.push(`❌ 良いレター: FAIL (score: ${goodScore}, issues: ${goodResult.reasons.join(', ')})`);
  }

  // テスト2: 禁止ワードを含むレター
  const badLetter = `御社のご活躍を拝見し、感銘を受けました。
業務効率化とコスト削減により、多くの企業様で大幅に削減を実現しています。
業界トップクラスのサービスです。`;

  const badResult = validateLetterOutput(badLetter, [], { mode: 'complete' });
  const badScore = calculateQualityScore(badLetter, [], 'complete');

  if (!badResult.ok || badScore < 50) {
    passed++;
    results.push(`✅ 禁止ワードレター: PASS (correctly rejected, score: ${badScore})`);
  } else {
    failed++;
    results.push(`❌ 禁止ワードレター: FAIL (should be rejected)`);
  }

  // テスト3: 文字数不足
  const shortLetter = 'これは短すぎるレターです。';
  const shortResult = validateLetterOutput(shortLetter, [], { mode: 'complete', minChars: 250 });

  if (!shortResult.ok && shortResult.reasons.some(r => r.includes('文字数'))) {
    passed++;
    results.push(`✅ 短すぎるレター: PASS (correctly rejected for length)`);
  } else {
    failed++;
    results.push(`❌ 短すぎるレター: FAIL (should be rejected for length)`);
  }

  // テスト4: Draftモードのプレースホルダー
  const draftLetter = `株式会社【要確認: 企業名】
代表取締役 【要確認: 担当者名】 様

貴社の課題について...`;

  const draftResult = validateLetterOutput(draftLetter, [], { mode: 'draft' });
  const completeResult = validateLetterOutput(draftLetter, [], { mode: 'complete' });

  if (!completeResult.ok && draftResult.reasons.length <= completeResult.reasons.length) {
    passed++;
    results.push(`✅ Draftプレースホルダー: PASS (correctly handled by mode)`);
  } else {
    failed++;
    results.push(`❌ Draftプレースホルダー: FAIL`);
  }

  console.log(results.join('\n'));
  console.log(`\n合計: ${passed} passed, ${failed} failed`);

  return { passed, failed, results };
}

// メイン実行
async function main() {
  console.log('========================================');
  console.log('CxO Letter Maker Phase 5 品質テスト');
  console.log('========================================');
  console.log(`実行日時: ${new Date().toISOString()}\n`);

  // ローカル品質ゲートテスト
  const localResults = runLocalQualityTests();

  // レポート生成
  const report = `# Phase 5 品質テストレポート

実行日時: ${new Date().toISOString()}

## ローカル品質ゲートテスト

${localResults.results.map(r => `- ${r}`).join('\n')}

**結果**: ${localResults.passed} passed / ${localResults.failed} failed

## テストケース一覧

${TEST_CASES.map((tc, i) => `${i + 1}. **${tc.name}**: ${tc.description}`).join('\n')}

## API統合テストについて

APIエンドポイント:
- \`POST /api/analyze-input\`: 入力分析
- \`POST /api/generate-v2\`: レター生成（v2）

統合テストを実行するには:
\`\`\`bash
BASE_URL=http://localhost:3000 npx tsx scripts/test-quality.ts --integration
\`\`\`

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
`;

  // レポート出力
  const reportPath = '/Users/kazfoy/Desktop/開発/cxo-letter-maker/quality_report.md';
  fs.writeFileSync(reportPath, report);
  console.log(`\n\nレポートを生成しました: ${reportPath}`);
}

main().catch(console.error);
