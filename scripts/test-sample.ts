/**
 * サンプルデータ品質検証スクリプト
 *
 * 使用方法:
 * npm run test:sample
 */

import { SAMPLE_DATA } from '../src/lib/sampleData';

// 禁止パターンの定義
const FORBIDDEN_PATTERNS = [
  { pattern: /A社/, name: '架空企業参照（A社）' },
  { pattern: /\d+%/, name: '根拠不明の数値（%）' },
  { pattern: /講演/, name: '架空イベント（講演）' },
  { pattern: /拝聴/, name: '架空イベント（拝聴）' },
  { pattern: /株式会社○○/, name: 'テンプレ架空表現（株式会社○○）' },
];

// URL検証用の正規表現
const URL_PATTERN = /^https?:\/\/.+/;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  // 1. 必須フィールド検証
  const requiredFields = ['myCompanyName', 'myName', 'myServiceDescription'] as const;
  let requiredPassed = true;
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = SAMPLE_DATA[field];
    if (!value || value.trim() === '') {
      requiredPassed = false;
      missingFields.push(field);
    }
  }

  results.push({
    name: '必須フィールド検証',
    passed: requiredPassed,
    message: requiredPassed
      ? `myCompanyName, myName, myServiceDescription が設定済み`
      : `空のフィールド: ${missingFields.join(', ')}`,
  });

  // 2. targetUrl 検証
  const targetUrl = (SAMPLE_DATA as Record<string, string>).targetUrl;
  const targetUrlPassed = targetUrl && URL_PATTERN.test(targetUrl);

  results.push({
    name: 'targetUrl検証',
    passed: !!targetUrlPassed,
    message: targetUrlPassed
      ? `有効なURL: ${targetUrl}`
      : targetUrl
        ? `無効なURL形式: ${targetUrl}`
        : 'targetUrl が未設定',
  });

  // 3. 禁止パターン検証
  // 全フィールドを結合
  const allText = Object.values(SAMPLE_DATA)
    .filter((v) => typeof v === 'string')
    .join('\n');

  // 「ご担当者様」を除去してから「担当者」をチェック
  const textForTantousha = allText.replace(/ご担当者様/g, '');
  const hasTantousha = /担当者/.test(textForTantousha);

  const foundPatterns: string[] = [];

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    if (pattern.test(allText)) {
      foundPatterns.push(name);
    }
  }

  if (hasTantousha) {
    foundPatterns.push('断定的担当者表現（担当者）');
  }

  const patternPassed = foundPatterns.length === 0;

  results.push({
    name: '禁止パターン検証',
    passed: patternPassed,
    message: patternPassed
      ? '禁止パターンなし（A社, %, 講演, 拝聴, 株式会社○○, 担当者）'
      : `検出: ${foundPatterns.join(', ')}`,
  });

  return results;
}

function main(): void {
  console.log('========================================');
  console.log('サンプルデータ品質検証テスト');
  console.log('========================================');
  console.log(`実行日時: ${new Date().toISOString()}\n`);

  const results = runTests();

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name}`);
    console.log(`  → ${result.message}\n`);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('========================================');
  console.log(`結果: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }

  console.log('\n✅ すべてのサンプルデータ検証テストに合格しました');
}

main();
