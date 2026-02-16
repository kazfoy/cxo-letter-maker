/**
 * /api/generate-v2
 *
 * 分析結果を材料に、推測なしでCxO向けレターを生成する
 * Self-Correction: qualityGate → 詳細スコア → リライトのループ
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiGuard } from '@/lib/api-guard';
import { generateJson, TEMPERATURE } from '@/lib/gemini';
import { checkSubscriptionStatus } from '@/lib/subscription';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';
import { getClientIp } from '@/lib/get-client-ip';
import { createClient } from '@/utils/supabase/server';
import {
  validateLetterOutput,
  calculateDetailedScore,
  calculateEventQualityScore,
  type ProofPoint,
} from '@/lib/qualityGate';
import { selectFactsForLetter, isPublicSectorOrg, isStartupCompany, detectCelebrationFromFacts, enrichSourcesWithFacts } from '@/lib/factSelector';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { sanitizePersonName } from '@/lib/personNameUtils';
import { SAMPLE_SENDER_COMPANIES } from '@/lib/sampleData';
import { devLog } from '@/lib/logger';
import type { AnalysisResult, SelectedFact } from '@/types/analysis';
import {
  GenerateV2RequestSchema,
  GenerateV2OutputSchema,
  type SenderInfo,
  type UserOverrides,
  type GenerateV2Output,
  type Quality,
  type Citation,
} from '@/types/generate-v2';

export const maxDuration = 60;

/**
 * Event招待状モード専用の追加指示を構築
 */
function buildEventModeInstructions(
  overrides: UserOverrides | undefined,
  sender: SenderInfo
): string {
  const eventName = overrides?.event_name || '（未指定）';
  const eventDateTime = overrides?.event_datetime || '（未指定）';
  const eventSpeakers = overrides?.event_speakers || '（未指定）';
  const eventPosition = overrides?.event_position;

  // 立ち位置テキスト（デフォルト: 協賛）
  const positionText = {
    sponsor: `弊社（${sender.company_name}）は本イベントの協賛企業として参加しております`,
    speaker: `弊社（${sender.company_name}）は本イベントに登壇企業として参加しております`,
    case_provider: `弊社（${sender.company_name}）は本イベントにて導入事例をご紹介させていただきます`,
  }[eventPosition ?? 'sponsor'];

  return `
【イベント招待状モード - 絶対ルール（厳守）】

■ ルールa: 冷開拓の挨拶＋自己紹介【必須】
関係性がない相手への挨拶と名乗り:
- 1行目: 「突然のご連絡失礼いたします。${sender.company_name}の${sender.name}です。」
- NG: 「平素よりお世話になっております」← 関係性がないのに使うと違和感
- NG: 自己紹介なしでいきなり本題 ← 誰からの連絡か不明

■ ルールb: フックと提案テーマの接続【ブリッジ必須】
フック（相手の情報）と提案テーマは1行で橋渡しする:
- OK: 「新たな施策が増えるほど、グループ全体で統制が効いていることが前提になりやすい」
- NG: 「オートサロン開催→間接業務DXが重要」← 接続が飛んで見える

■ ルールc: 無根拠診断・断定の禁止
以下のパターンは使用禁止:
- NG: 「貴社では〇〇が課題と推察いたします」
- NG: 「貢献できるかと存じます」「実現できます」← 成果断定は強すぎ
- OK: 「論点が整理できる」「進め方が明確になる」← 柔らかい表現

■ ルールd: 立ち位置の明確化【矛盾禁止】
主催と協賛を混同しない:
- 協賛の場合: 「弊社は協賛企業として参加し、〇〇を事例ベースでご紹介します」
- 主催の場合: 「弊協会では〇〇を開催いたします」
- NG: 「協賛企業として参加」+「開催いたします」← 矛盾

■ ルールe: 登壇者の書き方
未確定の場合は役職名でぼかす:
- NG: 「経営企画責任者（予定）」← 「（予定）」は信頼を削る
- OK: 「製造業の実務責任者クラス」「大手製造業の経営企画・内部監査責任者」

■ ルールf: セミナー価値は"持ち帰り"を具体的に3点
抽象的な表現を避け、具体的なベネフィットを3つ明記:
- NG: 「最新事例やノウハウをご紹介」← 抽象的で他と差別化できない
- OK: 「1. 間接業務DXの論点整理チェックリスト」
- OK: 「2. 標準プロセスの型と進め方」
- OK: 「3. 監査で指摘されやすいポイントの整理」

■ ルールg: CTAは2択で1クリック設計
返信を簡単にする:
- OK: 「参加希望の場合は『参加』、ご都合が合わない場合は『資料希望』とご返信ください」
- NG: 「ぜひ一度15分お時間をいただき」← 面談要求禁止

■ ルールh: 文章は短め（5段落以内、300-450文字）
- 全体を5段落以内に収める
- 各段落は2-3文を目安
- 段落と段落の間は必ず改行(\\n\\n)で区切ること（1つの段落にまとめて書くのは禁止）

【イベント情報】
イベント名: ${eventName}
開催日時: ${eventDateTime}
登壇者: ${eventSpeakers}
立ち位置: ${positionText}
`;
}

/**
 * 公共機関向け文体・CTA指示を構築
 */
function buildPublicSectorInstructions(): string {
  return `
【公共機関・教育機関向け — 文体・CTA特別ルール（厳守）】

■ 文体ルール
- 「ご面談のお時間」→「情報交換の機会」に置き換え
- 「弊社のソリューション」→「弊社の取り組み・事例」に置き換え
- 「導入」→「活用」に置き換え
- 「ご提案」→「情報提供」に置き換え
- 「お打ち合わせ」→「意見交換」に置き換え
- 敬語レベルを官公庁対応に引き上げる（「いただけますと幸いです」「賜れますと幸甚に存じます」等）
- 営業色を排除し、あくまで情報提供・事例共有のスタンスを維持

■ CTA（行動喚起）ルール
- NG: 「15分のお打ち合わせ」「ご商談」「デモのご依頼」
- OK: 「事例共有の機会」「情報提供のお時間」「意見交換の場」
- 2択は以下のいずれか:
  1. 「事例資料をお送りする」
  2. 「30分ほど情報交換の機会をいただく」

■ 禁止表現（公共機関向け追加）
- 「売上」「収益」「利益率」（公共機関には不適切）
- 「競合他社」「市場シェア」（競争文脈を避ける）
- 「ROI」「コスト削減」（民間企業の指標）
→ 代替: 「住民サービスの向上」「行政運営の高度化」「業務の質的改善」
`;
}


/**
 * 生成プロンプトを構築
 */
function buildGenerationPrompt(
  analysis: AnalysisResult,
  overrides: UserOverrides | undefined,
  sender: SenderInfo,
  mode: 'draft' | 'complete' | 'event',
  format: 'letter' | 'email',
  factsForLetter: SelectedFact[] = [],
  improvementPoints?: string[],
  hasTargetUrl: boolean = false,
  isPublicSector: boolean = false,
  isStartup: boolean = false,
  celebrationText: string = ''
): string {
  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = sanitizePersonName(overrides?.person_name || analysis.facts.person_name);
  const personPosition = overrides?.person_position || analysis.facts.person_position || '';

  let modeInstruction: string;
  let eventModeInstructions = '';

  if (mode === 'draft') {
    modeInstruction = '【下書きモード】情報が不足している箇所は【要確認: 〇〇】の形式でプレースホルダーを使用してください。推測で情報を埋めないでください。';
  } else if (mode === 'event') {
    modeInstruction = '【イベント招待状モード】イベントへの招待状を作成してください。';
    eventModeInstructions = buildEventModeInstructions(overrides, sender);
  } else {
    modeInstruction = '【完成モード】すべての情報を具体的に記載してください。プレースホルダー（【要確認:】、〇〇、●●など）は使用禁止です。';
  }

  // リライト時の改善指示
  let retryInstruction = '';
  if (improvementPoints && improvementPoints.length > 0) {
    retryInstruction = `\n\n【リライト注意】前回の生成は品質基準を満たしませんでした。以下の点を改善してください：
${improvementPoints.map(p => `- ${p}`).join('\n')}`;
  }

  // 品質強化ルール（CxOレター必須）— MUST/NEVER合意に基づく
  const qualityEnhancementRules = `
【品質ルール（違反時リライト）】

■ MUST条件（すべて満たすこと）
1. Why now（なぜ今）: 直近1-3ヶ月の決算・人事・新事業など、相手に固有の「時期的理由」を冒頭に含める
2. So what?（だから何）: HPの事実をそのままコピペせず、「その事実が相手の経営にとって何を意味するか」を1文で変換する
3. ブリッジ整合: ファクト→提案テーマは同じ部門・同じ予算枠・同じ決裁者の範囲で接続。飛躍禁止
4. ファクトファースト: 冒頭は必ず相手企業の情報（Why you/Why now）から始める。自社紹介から始めるのは禁止
5. 定量的事例: 他社事例を出す場合は必ず「削減率」「短縮日数」「金額」などの数字を含める
6. CTA受取人ベネフィット: 面談依頼だけでなく、相手が得られる具体物（レポート、ベンチマーク資料、チェックリスト等）を提示する
7. 自社紹介は全体の15%以下: 弊社/当社への言及は最小限に。レターの主役は「相手企業」
8. 推定ROI: 可能な限り「御社の場合〜規模の効果が見込まれます」と概算を示す
9. 仮説は質問形: 「〜ではないでしょうか」「〜が論点になりやすいです」等、質問・問いかけ形式にする
10. パーソナライゼーション: その企業にしか当てはまらない固有の内容を含める

■ NEVER条件（1つでも該当したらリライト）
1. HPコピペ: 企業HPの文章をそのまま引用するのは禁止。必ず独自解釈に変換する
2. 論理飛躍: 「〇〇を発表 → だから弊社のサービスが必要」のような根拠なき接続禁止
3. 冒頭自社PR: 「弊社は〜を提供しております」で始めるのは禁止
4. 抽象的背景: 「急速に変化する」「DX推進が急務」など誰にでも当てはまるフレーズ禁止
5. 段落丸ごと自社PR: 第2段落以降で自社紹介だけの段落を作るのは禁止。必ず事例・数字と一体にする
6. 数字ゼロ: 事例を出すなら必ず数値を添える。「多くの企業」「大幅に削減」は禁止
7. 受動的CTA: 「ぜひ一度お話しさせてください」「ご検討のほど」は具体性ゼロで禁止
8. Why now不在: 「なぜ今この企業に連絡するのか」が読み取れない手紙は禁止
9. 無根拠断定: 「貴社では〜が課題と推察します」「確信しております」は禁止
10. 過度な営業トーン: 「必ずお役に立てます」「実現できます」等の成果断定禁止

■ 禁止表現【HARD NO】
推察/想定/断定/感銘/統一されておらず/残存/課題が生じている/必ずお役に立てます/貢献できると確信
→ 代替: 「〜が論点になりやすいです」「御社の現状を伺い」

■ 構成比率【厳守】
- 第1段落（Why you/Why now + 仮説）: 全体の40-50%
- 第2段落（事例 + 推定ROI）: 全体の30-35%
- 第3段落（CTA + 受取人ベネフィット + 署名）: 全体の15-25%
- 弊社/当社への言及: 全体の15%以下

■ テーマ接続: フックと提案テーマを1文で橋渡し（ワープ禁止）
■ ベネフィット: メイン1本+補助線1本（並列禁止）
■ 宛名: 個人名あり→「社名 氏名様」、なし→「社名 役職名様」
■ プレースホルダー禁止(完成モード): 「〇〇」「●●」「【要確認】」不可。数値不明なら文ごと削る

■ 文末バリエーション【必須】
「ではないでしょうか」は全文で最大1回。2回目以降は以下の別表現を使用:
- 「〜とお見受けいたします」「〜が論点になりやすいです」
- 「〜を検討される企業が増えております」「〜かと存じます」

■ 自社サービス射程範囲【厳守】
- 【差出人情報】のサービス概要に明記されている機能・領域のみ言及可
- 概要に書かれていない分野を「弊社の強み」として語ることは禁止

【レター品質基準（必ず参照）】

良いレター例1（So what? + Why now + CTA受取人ベネフィット）:
---
2026年2月6日発表の第1四半期決算にて、連結子会社112社体制での事業拡大方針を拝見しました。子会社数がこの規模に達すると、申請・承認ルートや証憑管理ルールが各社でばらつき、グループ全体の統制コストが論点になりやすいのではないでしょうか。

同じくインターネット大手のD社様では、グループ共通の間接業務基盤を導入されたことで、経理部門の月次作業時間を22%削減し、内部監査の指摘件数を半減されました。御社の112社体制に同様の効果が波及すれば、年間で数億円規模のガバナンスコスト最適化が見込まれます。

今月中に15分ほどオンラインで、連結子会社管理における証憑・承認の統制方針について情報交換の機会をいただけませんでしょうか。事前に「連結子会社100社超の間接業務ベンチマーク資料」をお送りいたします。
---
→ 良い理由: 1.冒頭がWhy now(決算発表日+112社) 2.So what?変換(112社→統制コスト論点) 3.事例が具体的(22%削減、指摘半減) 4.推定ROI(数億円規模) 5.CTAにベネフィット(ベンチマーク資料) 6.自社紹介が15%以下

良いレター例2（新事業トリガー + ゼロベース設計の問い）:
---
「BE creation」新事業創出スキームにて、企画から量産までの一気通貫体制を構築されていると拝見しました。新組織の立ち上げ期には、購買・経費・契約といった間接業務のワークフローを既存プロセスに準拠させるか、ゼロベースで設計するかが論点になりやすいです。

同業大手のH社様では、新事業部門の間接業務をゼロベースで再設計したことで、購買申請から承認完了までのリードタイムを40%短縮し、年間監査対応工数を約1,200時間削減されました。この規模の新体制では、初期に業務フローの型を整えるか否かで、3年後の運用コストに数千万円単位の差が出ると見込まれます。

来週のご都合の良い日に15分ほど、新事業部門の間接業務オペレーション設計について情報交換させていただけませんでしょうか。「製造業の新事業間接業務設計チェックリスト」を事前にお送りいたします。
---
→ 良い理由: 1.ファクトファースト(BE creation) 2.So what?(新組織→ワークフロー設計の論点) 3.事例+数値(40%短縮、1,200時間削減) 4.推定ROI(数千万円) 5.CTAにベネフィット(チェックリスト)

悪いレター例（このパターンを避ける）:
---
弊社は経費精算のクラウドソリューションを提供しております。貴社におかれましても、業務効率化やDX推進に取り組まれていることと存じます。弊社のソリューションは多くの企業様にご導入いただいており、ぜひ一度ご紹介させてください。
---
→ 悪い理由: 1.冒頭が自社紹介(NEVER#3違反) 2.「DX推進」は一般論(NEVER#4違反) 3.「多くの企業」で数字ゼロ(NEVER#6違反) 4.「ぜひ一度」でCTA受動的(NEVER#7違反) 5.Why now不在(NEVER#8違反)
`;

  // 使用可能な証拠をリスト化
  const proofPointsList = analysis.proof_points.length > 0
    ? analysis.proof_points.map(p => `- [${p.type}] ${p.content} (確度: ${p.confidence})`).join('\n')
    : '（証拠ポイントなし - 下書きモードではプレースホルダーを使用）';

  const newsList = analysis.recent_news.length > 0
    ? analysis.recent_news.map(n => `- ${n.headline}: ${n.summary}`).join('\n')
    : '（最新ニュースなし）';

  const signalsList = analysis.signals.length > 0
    ? analysis.signals.map(s => `- ${s.description} (${s.type}, 確度: ${s.confidence})`).join('\n')
    : '（経営シグナルなし）';

  // Phase 5: 抽出ファクトの整形
  const extractedFacts = analysis.extracted_facts;
  const hasExtractedFacts = extractedFacts &&
    Object.values(extractedFacts).some(arr => arr.length > 0);

  let extractedFactsList = '';
  if (hasExtractedFacts) {
    const factItems: string[] = [];
    // 新形式（ExtractedFactItem）に対応
    const formatFactArray = (arr: Array<string | { content: string }>) =>
      arr.map(f => typeof f === 'string' ? f : f.content).join(', ');

    if (extractedFacts.numbers.length > 0) {
      factItems.push(`- 数値情報: ${formatFactArray(extractedFacts.numbers)}`);
    }
    if (extractedFacts.properNouns.length > 0) {
      factItems.push(`- 固有名詞: ${formatFactArray(extractedFacts.properNouns)}`);
    }
    if (extractedFacts.recentMoves.length > 0) {
      factItems.push(`- 最近の動き: ${formatFactArray(extractedFacts.recentMoves)}`);
    }
    if (extractedFacts.hiringTrends.length > 0) {
      factItems.push(`- 採用動向: ${formatFactArray(extractedFacts.hiringTrends)}`);
    }
    if (extractedFacts.companyDirection.length > 0) {
      factItems.push(`- 会社の方向性: ${formatFactArray(extractedFacts.companyDirection)}`);
    }
    extractedFactsList = factItems.join('\n');
  }

  // Phase 6: ブリッジ構造指示（ファクトがある場合）
  let bridgeInstruction = '';
  if (factsForLetter.length > 0) {
    const bridgeReasons = factsForLetter
      .filter(f => f.bridgeReason)
      .map(f => `- ${f.quoteKey}: ${f.bridgeReason}`)
      .join('\n');

    // Why nowトリガー候補（最新ニュースから抽出）
    const whyNowCandidates = analysis.recent_news
      .filter(n => n.date)
      .slice(0, 2)
      .map(n => `- ${n.date}: ${n.headline}`)
      .join('\n');

    bridgeInstruction = `\n\n【ブリッジ構造 + Why now（必須）】
冒頭200文字以内に以下の流れを必ず含めること：
1. Why now: 直近1-3ヶ月の具体的イベント（決算、人事、新事業発表等）を日付付きで引用
2. So what?: そのイベントが経営にとって何を意味するかを独自解釈で1文に変換（HPの文面をそのまま使わない）
3. 仮説: 「〜ではないでしょうか」「〜が論点になりやすいです」で相手の課題を問いかけ
4. ブリッジ: 仮説と提案テーマが同じ部門・予算枠・決裁者の範囲で自然に接続すること

Why nowトリガー候補:
${whyNowCandidates || '（直近ニュースなし → 抽出ファクトからWhy youを構成）'}

参考ブリッジ理由:
${bridgeReasons || '（ブリッジ理由なし）'}

★重要: ファクトのSo what?変換例
NG: 「貴社が連結子会社112社を持つことを拝見しました」 ← HPコピペ
OK: 「連結子会社112社体制では、申請・承認ルートが各社でばらつき、統制コストが論点になりやすい」 ← 独自解釈`;
  }

  // 選定ファクトの必須引用指示（Phase 6強化版）
  let factsForLetterInstruction = '';
  if (factsForLetter.length > 0) {
    const factsList = factsForLetter.map(f =>
      `- ${f.quoteKey}: ${f.content}`
    ).join('\n');
    factsForLetterInstruction = `\n\n【必須引用ファクト（冒頭200文字以内に1つ以上使用）】
${factsList}

★ファクト使用ルール:
- HPの文面を3語以上そのまま引用するのは禁止。必ず「So what?」変換を施すこと
- 変換方法: 「事実 → その事実が経営にとって何を意味するか」に言い換える
- NG: 「貴社は○○を推進されています」← 事実の転記に過ぎない
- OK: 「○○の推進は、△△の観点で□□が論点になりやすい」← 独自の洞察

一般論禁止: CASE/MaaS/100年に一度/急務/喫緊/多くの企業では/一般的に/近年では — 使用不可`;
  }

  // エビデンスルール（3段階仮説モード + proof_points引用ルール）
  const factCount = factsForLetter.length;
  const hasConcreteProofPoints = analysis.proof_points.some(
    p => p.type === 'case_study' && p.confidence !== 'low'
  );
  let evidenceRule: string;

  if (!hasTargetUrl || factCount === 0) {
    // 完全仮説モード
    evidenceRule = `\n\n【エビデンスルール — 完全仮説モード】
架空の数字・社名・実績は禁止。
- 具体数字・固有名詞は使用不可
- すべて仮説形式で記述（「〜が論点になりやすいです」「〜とお見受けいたします」）
- 業界傾向は「〜業界では〜という傾向があると聞きます」の形式
- 事例セクションは省略し、具体的な「アプローチの提示」に置き換え（例: 「まず現状の〇〇を30分で棚卸しし、優先度の高い論点を整理いたします」）`;
  } else if (factCount <= 2) {
    // 部分仮説モード
    evidenceRule = `\n\n【エビデンスルール — 部分仮説モード（ファクト${factCount}件）】
架空の数字・社名・実績は禁止。提供データのみ使用可。
- 抽出ファクトは正確に引用可。それ以外の具体情報は仮説形式で
- ファクトでカバーされない領域は「〜が論点になりやすいです」等の仮説形式
- 不足情報を推測で補わないこと`;
  } else {
    // 通常モード
    evidenceRule = `\n\n【エビデンスルール — 通常モード】
架空の数字・社名・実績は禁止。提供データのみ使用可。断定→仮説形式に。`;
  }

  // proof_points引用ルール（3段階）
  if (hasConcreteProofPoints) {
    evidenceRule += `\n■ 実績引用: proof_pointsに具体事例あり → そのまま引用可`;
  } else if (analysis.proof_points.length > 0) {
    evidenceRule += `\n■ 実績引用: 「同業界のお客様では」＋proof_pointsの数字のみ使用可。社名の捏造禁止`;
  } else {
    evidenceRule += `\n■ 実績引用: proof_pointsに事例なし → 事例は書かず「アプローチの提示」に。迷ったら事例を書かない`;
  }

  // 冒頭の宛名フォーマット（人名不明時は役職名を使用。「ご担当者様」はCxOレターとして不適切）
  const recipientFormat = personName
    ? `${companyName} ${personPosition} ${personName}様`
    : companyName
    ? `${companyName} ${personPosition || '経営企画ご責任者'}様`
    : '';

  // citations出力指示
  const citationInstruction = factsForLetter.length > 0
    ? `\n\n【citations】引用文ごとにsentence(50文字以内)+quoteKeyを出力。body本文に[citation:]等のマーカーは絶対不可。`
    : '';

  // 公共機関向け指示
  const publicSectorInstruction = isPublicSector ? buildPublicSectorInstructions() : '';

  // スタートアップ向けトーン調整指示
  const startupToneInstruction = isStartup ? `
【スタートアップ向けトーン調整（厳守）】
- 「貴社」→「御社」に統一
- 敬語レベルを1段下げる（「〜いただけませんでしょうか」→「〜いかがでしょうか」）
- 形式張った挨拶（「謹啓」「拝啓」等）は省略
- 「スピード感」「アジリティ」「スケール」等のスタートアップ的価値観に合わせる
- CTAもカジュアルに（「カジュアルにお話しできれば」「15分ほどオンラインで情報交換いかがでしょうか」等）
- 冗長な敬語の重ね（「〜していただけますと幸甚に存じます」）は避け、簡潔に
` : '';

  // お祝い事冒頭反映指示
  const celebrationInstruction = celebrationText ? `
【お祝い事の冒頭反映（必須）】
レターの冒頭（宛名の直後）で、以下の慶事について一言触れてから本題に入ること:
「${celebrationText}」
例: 「この度の${celebrationText}、誠におめでとうございます。」
※ 1行以内に収め、本題への導入として自然につなげること。
※ お祝いの後にすぐWhy you/Why nowのフックに接続すること。
` : '';

  return `あなたは経営コンサルティングファーム出身のビジネスアドバイザーです。
企業の公開情報を独自に分析し、「業界知見のあるコンサルタントの視座」でCxO向けの${format === 'email' ? 'メール' : '手紙'}を作成してください。
セールスレターではなく、業界の専門家が洞察を共有する手紙を書いてください。

${modeInstruction}${eventModeInstructions}${qualityEnhancementRules}${retryInstruction}${bridgeInstruction}${factsForLetterInstruction}${evidenceRule}${citationInstruction}${publicSectorInstruction}${startupToneInstruction}${celebrationInstruction}

【絶対ルール】
1. 架空禁止。提供データのみ使用可
2. 儀礼的褒め言葉禁止（「感銘を受けました」等）
3. 視点: ガバナンス強化/経営スピード向上/リスク低減（業務効率化/コスト削減NG）
4. 350-500文字。体言止め禁止（「です」「ます」で終える）
5. 冒頭: 「${recipientFormat || '【企業名】【役職】【氏名】様'}」
6. 構造: Why now/Why you→So what?仮説→事例+推定ROI→CTA+受取人ベネフィット
7. 段落分け必須: 必ず3段落に分け、段落の間を改行(\\n\\n)で区切ること。1つの段落にまとめるのは絶対禁止
8. 【企業分析AIが抽出したキーワード】の表現を3語以上連続で使用禁止。論点は参考にしてよいが、文章は必ず一から構築すること（So what?変換必須）
  NG例: キーワード「経費精算プロセスの可視化」→生成文「経費精算プロセスの可視化が課題です」（そのまま使用）
  OK例: キーワード「経費精算プロセスの可視化」→生成文「出張費や交際費の承認フローが部署ごとに異なり、全社での支出状況が見えにくいのではないでしょうか」（独自の文章）
9. 自社紹介は全体の15%以下: 「弊社は」「当社では」から始まる文は2文以内に収める。段落丸ごと自社紹介にしない
10. 第2段落は「事例+推定ROI」で構成: 匿名可だが必ず数値を含める（例: 「同業のA社では22%削減」「年間約8億円の効果」）

【CTA（ネクストステップ）の書き方 — 厳守】
良い例:
- 「来週15分ほどオンラインで情報交換の機会をいただけませんでしょうか。事前に「〇〇ベンチマーク資料」をお送りいたします」
- 「今月中に15分ほど、連結子会社管理のチェックリストをお持ちして情報交換の機会を頂戴できれば幸いです」
悪い例（避ける）:
- 「ぜひ一度お話しさせてください」→ 曖昧すぎる。受取人のメリットが不明
- 「ご検討のほどお願いいたします」→ アクションが不明確
- 「15分ほど情報交換の機会をいただけませんでしょうか」→ 受取人ベネフィットが欠落
ルール:
1. 具体的な時間枠を提示する（15分、30分等）
2. 形式を明示する（オンライン、お電話、ご訪問等）
3. 期限を匂わせる（来週、今月中等）
4. ハードルを下げる（「情報交換」「事例共有」等）
5. 【受取人ベネフィット必須】面談と引き換えに相手が得られる具体物を明記（レポート、ベンチマーク資料、チェックリスト、業界比較データ等）

【ターゲット情報】
企業名: ${sanitizeForPrompt(companyName, 200) || '（未指定）'}
担当者名: ${sanitizeForPrompt(personName, 100) || '（未指定）'}
役職: ${sanitizeForPrompt(personPosition, 100) || '（未指定）'}
業界: ${analysis.facts.industry || '（未指定）'}

【経営シグナル（仮説）】
${signalsList}

【活用できる証拠】
${proofPointsList}

【最新ニュース】
${newsList}

${hasExtractedFacts ? `【抽出ファクト（Webサイトから取得）】
${extractedFactsList}` : ''}

【企業分析AIが抽出したキーワード（参考情報 — そのまま文章化は禁止）】
以下は企業分析AIが抽出したキーワードです。このまま文章に書き写すと機械的な印象になります。
必ずあなた自身の文章で一から構築してください。
- タイミングの理由: ${analysis.hypotheses.timing_reason}
- 課題仮説: ${analysis.hypotheses.challenge_hypothesis}
- 提供価値: ${analysis.hypotheses.value_proposition}
- CTA提案: ${analysis.hypotheses.cta_suggestion}
✓ 上記のキーワードを「着想」として活用してOK
✗ 上記の表現を3語以上連続で使用することは禁止
✓ 同じ論点を扱う場合でも、必ず独自の文章構成・言い回しで記述すること

【差出人情報】
企業名: ${sanitizeForPrompt(sender.company_name, 200)}
部署: ${sanitizeForPrompt(sender.department || '', 200)}
氏名: ${sanitizeForPrompt(sender.name, 100)}
サービス: ${sanitizeForPrompt(sender.service_description, 1000)}

${overrides?.additional_context ? `【追加コンテキスト】\n${sanitizeForPrompt(overrides.additional_context, 1000)}` : ''}

${overrides?.cxo_insight ? `【CxO個人の発信情報（最重要 — 必ずレターに反映すること）】
以下はターゲットCxO個人の発信内容です。レターの冒頭で必ずこの情報に触れ、「あなた個人のことを理解しています」というメッセージを伝えてください:
${sanitizeForPrompt(overrides.cxo_insight, 1000)}` : ''}

${overrides?.mutual_connection ? `【共通の接点（レターの冒頭で必ず言及すること）】
以下の共通の接点情報を、レターの最初の1-2文で自然に言及してください。この情報はレターの返信率に最も影響します:
${sanitizeForPrompt(overrides.mutual_connection, 500)}` : ''}

【出力形式】
以下のJSON形式で出力してください：
★重要: bodyフィールドは必ず段落ごとに改行(\\n\\n)で区切ること。1つの段落にまとめて書くのは禁止。
{
  "subjects": ["件名候補1（25文字目安、抽象語禁止）", "件名候補2", "件名候補3", "件名候補4", "件名候補5"],
  "body": "宛名行\\n\\n第1段落（Why now + So what?仮説: 直近イベントを引用し、相手にとっての経営的意味を問いかける。全体の40-50%）\\n\\n第2段落（他社事例 + 推定ROI: 匿名可だが必ず数値付きの事例。御社に換算した効果見込みも記載。全体の30-35%。弊社紹介は最小限）\\n\\n第3段落（CTA + 受取人ベネフィット + 署名: 時間枠・形式・期限に加え、資料やレポート等の具体物を提示。全体の15-25%）",
  "rationale": [
    { "type": "timing", "content": "今連絡する理由" },
    { "type": "evidence", "content": "使用した証拠" },
    { "type": "value", "content": "提供価値" }
  ],
  "variations": {
    "standard": "王道パターン（業界トレンド仮説リード）※段落は\\n\\nで区切る",
    "emotional": "熱意パターン（具体的成功事例リード）※段落は\\n\\nで区切る",
    "consultative": "課題解決パターン（リスク・規制観点リード）※段落は\\n\\nで区切る"
  }${factsForLetter.length > 0 ? `,
  "citations": [
    {
      "sentence": "〜を拝見しました...",
      "quoteKey": "factsForLetterのquoteKey"
    }
  ]` : ''}
}`;
}

/**
 * ポストプロセス: 禁止ワード・プレースホルダーの自動置換/除去
 *
 * qualityGateで検出してリトライしても残る場合の最終防衛ライン
 */
function postProcessLetterBody(body: string, mode: 'draft' | 'complete' | 'event'): string {
  let processed = body;

  // 1. 推察系の自動置換（complete/eventモード）
  // 同一フレーズへの一律置換を避け、バリエーションを持たせる
  if (mode !== 'draft') {
    // パターン1用の代替表現（独立した文で使用）
    const softAlternativesStandalone = [
      'ではないでしょうか',
      'ではないかと存じます',
      'かと拝察いたします',
    ];
    // パターン2用の代替表現（「と」の後に続く形式）
    const softAlternativesWithPrefix = [
      'ではないでしょうか',
      '存じます',
      '拝察いたします',
    ];

    let altIndex1 = 0;
    let altIndex2 = 0;

    // ステップ1: 推察系の直接的な表現を置換
    processed = processed.replace(/推察いたします|推察します|想定されます/g, () => {
      return softAlternativesStandalone[altIndex1++ % softAlternativesStandalone.length];
    });

    // ステップ2: 「と推察〜」の形式を置換（接頭辞「と」を考慮）
    processed = processed.replace(/と推察しております|と想定しております/g, () => {
      const alt = softAlternativesWithPrefix[altIndex2++ % softAlternativesWithPrefix.length];
      return alt.startsWith('では') ? alt : `と${alt}`;
    });

    // ステップ3: 残存する「と推察」を簡易置換
    processed = processed.replace(/と推察/g, 'ではないかと');
  }

  // 2. プレースホルダーの除去（complete/eventモード）
  if (mode !== 'draft') {
    // 【要確認: ...】を含む文を丸ごと除去
    processed = processed.replace(/[^。\n]*【要確認[:：][^】]*】[^。\n]*[。]?/g, '');
    processed = processed.replace(/[^。\n]*\[要確認[:：][^\]]*\][^。\n]*[。]?/g, '');
    // 連続改行を整理
    processed = processed.replace(/\n{3,}/g, '\n\n');
  }

  // 3. citation/注釈マーカーの除去（全モード）
  processed = processed.replace(/\[citation[:：][^\]]*\]/gi, '');
  processed = processed.replace(/【citation[:：][^】]*】/gi, '');
  processed = processed.replace(/\[出典[:：][^\]]*\]/gi, '');
  processed = processed.replace(/【出典[:：][^】]*】/gi, '');

  // 4. 段落分割フォールバック（改行が不足している場合にセマンティック境界で段落を作る）
  const paragraphs = processed.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length < 3 && processed.length > 150) {
    // 改行が不足 → 複数の転換語パターンで段落分割を試行
    const transitionPatterns = [
      /(?=株式会社ネクサスソリューションズは)/,  // 自社紹介
      /(?=弊社は)/,        // 自社紹介の開始
      /(?=弊社の)/,        // 自社紹介バリエーション
      /(?=つきましては)/,  // 結びへの転換
      /(?=ぜひ)/,          // CTAの開始
      /(?=来週)/,          // CTA時間表現
      /(?=今月)/,          // CTA時間表現
      /(?=まず)/,          // 提案の開始
      /(?=具体的には)/,    // 具体化の開始
      /(?=特に、)/,        // 強調の開始
    ];

    // ステップ1: 宛名行を分離
    let bodyText = processed;
    let salutation = '';
    const salutationMatch = bodyText.match(/^(.+?様)\s*/);
    if (salutationMatch && salutationMatch[0].length < 80) {
      salutation = salutationMatch[1];
      bodyText = bodyText.slice(salutationMatch[0].length);
    }

    // ステップ2: 署名行を分離（末尾の「会社名\n担当者名」パターン）
    let signature = '';
    const sigPatterns = [
      /((?:株式会社|一般社団法人|合同会社)[^\n。、]*\n[^\n。、]+)$/,
      /((?:株式会社|一般社団法人|合同会社)[^\n。、]+)$/,
    ];
    for (const sigPattern of sigPatterns) {
      const sigMatch = bodyText.match(sigPattern);
      if (sigMatch && sigMatch[0].length < 100) {
        signature = sigMatch[1];
        bodyText = bodyText.slice(0, bodyText.length - sigMatch[0].length).trim();
        break;
      }
    }

    // ステップ3: 本文を転換語パターンで複数箇所分割
    const splitPositions: number[] = [];
    for (const pattern of transitionPatterns) {
      const match = bodyText.match(pattern);
      if (match && match.index && match.index > 50) {
        const tooClose = splitPositions.some(pos => Math.abs(pos - match.index!) < 50);
        if (!tooClose) {
          splitPositions.push(match.index);
        }
      }
    }

    if (splitPositions.length > 0) {
      splitPositions.sort((a, b) => a - b);
      const parts: string[] = [];
      let lastPos = 0;
      for (const pos of splitPositions) {
        const segment = bodyText.slice(lastPos, pos).trim();
        if (segment) parts.push(segment);
        lastPos = pos;
      }
      const lastSegment = bodyText.slice(lastPos).trim();
      if (lastSegment) parts.push(lastSegment);
      bodyText = parts.filter(p => p.length > 0).join('\n\n');
    }

    // ステップ4: 再構築
    const rebuilt = [salutation, bodyText, signature]
      .filter(p => p.length > 0)
      .join('\n\n');

    if (rebuilt !== processed) {
      processed = rebuilt;
      const newParagraphs = rebuilt.split(/\n\n+/).filter(p => p.trim()).length;
      devLog.warn(`PostProcess: Applied fallback paragraph splitting (${newParagraphs} paragraphs)`);
    }
  }

  return processed.trim();
}

/**
 * ProofPointを変換
 */
function convertToQualityGateProofPoints(analysisProofPoints: AnalysisResult['proof_points']): ProofPoint[] {
  return analysisProofPoints.map(p => ({
    type: p.type,
    content: p.content,
    source: p.source ?? undefined,
    confidence: p.confidence,
  }));
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    GenerateV2RequestSchema,
    async (data, _user) => {
      const { analysis_result, user_overrides, sender_info, mode, output_format, is_sample } = data;

      // サンプルリクエストの検証（クライアントからのフラグをサーバーサイドで検証）
      const isSampleRequest = is_sample === true &&
        (SAMPLE_SENDER_COMPANIES as readonly string[]).includes(sender_info.company_name);

      // サーバーサイドレート制限（ゲスト／Freeユーザー）— サンプルはスキップ
      const supabaseForAuth = await createClient();
      const { data: { user: currentUser } } = await supabaseForAuth.auth.getUser();

      if (currentUser) {
        // 認証済みユーザー: Freeプランの日次制限チェック
        const today = new Date().toISOString().split('T')[0];
        const { data: profile } = await supabaseForAuth
          .from('profiles')
          .select('plan, daily_usage_count, last_usage_date')
          .eq('id', currentUser.id)
          .single();

        if (profile) {
          const dailyCount = profile.last_usage_date !== today ? 0 : (profile.daily_usage_count || 0);
          if (profile.plan === 'free' && dailyCount >= 10) {
            return NextResponse.json(
              {
                success: false,
                error: '無料プランの1日の生成上限（10回）に達しました。',
                code: 'FREE_LIMIT_REACHED',
                suggestion: 'Proプランにアップグレードすると無制限で利用できます。',
              },
              { status: 429 }
            );
          }
        }
      } else if (!isSampleRequest) {
        // ゲストユーザー: IP + Cookieの二重チェック（3回/日）— サンプルはスキップ

        // 1. IPベース制限（Cookie削除/curlバイパス対策）
        const ip = await getClientIp();
        if (ip === 'unknown') {
          // IP取得不可 → fail-closed
          devLog.warn('Guest IP unknown, rejecting (fail-closed)');
          return NextResponse.json(
            {
              success: false,
              error: 'リクエストを処理できませんでした。',
              code: 'RATE_LIMITED',
            },
            { status: 429 }
          );
        }

        const { allowed: ipAllowed, usage: ipUsage } = await checkAndIncrementGuestUsage(`ip:${ip}`);
        if (!ipAllowed) {
          devLog.warn(`Guest IP rate limited: ${ip}`);
          return NextResponse.json(
            {
              success: false,
              error: 'ゲスト利用の上限（1日3回）に達しました。',
              code: 'GUEST_LIMIT_REACHED',
              message: '無料枠の上限に達しました。ログインすると無制限で利用できます。',
              usage: ipUsage,
            },
            { status: 429 }
          );
        }

        // 2. Cookieベース制限（従来の制限も維持）
        const cookieStore = await cookies();
        let guestId = cookieStore.get('guest_id')?.value || '';
        if (!guestId) {
          guestId = crypto.randomUUID();
          devLog.log('Generated new guest_id in generate-v2 API:', guestId);
        }

        const { allowed, usage } = await checkAndIncrementGuestUsage(guestId);
        if (!allowed) {
          return NextResponse.json(
            {
              success: false,
              error: 'ゲスト利用の上限（1日3回）に達しました。',
              code: 'GUEST_LIMIT_REACHED',
              message: '無料枠の上限に達しました。ログインすると無制限で利用できます。',
              usage,
            },
            { status: 429 }
          );
        }
      }

      // Pro機能の認可チェック（complete/eventはPro以上が必要）
      const PRO_MODES = ['complete', 'event'] as const;
      if ((PRO_MODES as readonly string[]).includes(mode)) {
        if (!currentUser) {
          return NextResponse.json(
            { success: false, error: 'この機能を利用するにはログインが必要です', code: 'AUTH_REQUIRED' },
            { status: 401 }
          );
        }

        // プランチェック
        const { isPro, isPremium } = await checkSubscriptionStatus(currentUser.id);
        if (!isPro && !isPremium) {
          return NextResponse.json(
            { success: false, error: 'この機能はProプラン以上で利用できます', code: 'PLAN_UPGRADE_REQUIRED' },
            { status: 403 }
          );
        }
      }

      const maxAttempts = 2; // 最大2回（初稿 + 1回リライト）
      let bestResult: GenerateV2Output | null = null;
      let bestQuality: Quality = {
        score: null,
        passed: false,
        issues: [],
        evaluation_comment: 'Not evaluated',
      };
      let improvementPoints: string[] = [];

      const proofPoints = convertToQualityGateProofPoints(analysis_result.proof_points);

      // ファクト選定
      const targetPosition = user_overrides?.person_position || (analysis_result.facts.person_position ?? undefined);
      const productStrength = sender_info.service_description;
      const { factsForLetter, usedFallback } = selectFactsForLetter(
        analysis_result.extracted_facts,
        targetPosition,
        productStrength,
        undefined, // targetChallenges
        undefined, // proposalTheme
        60, // confidenceThreshold
        {
          industry: analysis_result.facts.industry ?? undefined,
          companyName: user_overrides?.company_name || (analysis_result.facts.company_name ?? undefined),
        }
      );

      devLog.log(`Selected ${factsForLetter.length} facts for letter${usedFallback ? ' (with fallback)' : ''}`);

      // targetUrl有無の判定（プロンプト構築で使用）
      const hasTargetUrl = Boolean(user_overrides?.target_url || analysis_result.target_url);

      // 公共機関判定（文体・CTA切り替えに使用）
      const isPublicSector = isPublicSectorOrg({
        targetUrl: user_overrides?.target_url || analysis_result.target_url || undefined,
        companyName: user_overrides?.company_name || (analysis_result.facts.company_name ?? undefined),
        industry: analysis_result.facts.industry ?? undefined,
      });
      if (isPublicSector) {
        devLog.log('Public sector detected: applying public sector tone/CTA rules');
      }

      // スタートアップ判定（トーン調整に使用）
      const isStartup = !isPublicSector && isStartupCompany({
        targetUrl: user_overrides?.target_url || analysis_result.target_url || undefined,
        companyName: user_overrides?.company_name || (analysis_result.facts.company_name ?? undefined),
        industry: analysis_result.facts.industry ?? undefined,
        extractedFacts: analysis_result.extracted_facts,
      });
      if (isStartup) {
        devLog.log('Startup detected: applying casual tone adjustments');
      }

      // お祝い事検出（冒頭反映に使用）
      const { hasCelebration, celebrationText } = detectCelebrationFromFacts(factsForLetter);
      if (hasCelebration) {
        devLog.log(`Celebration detected: ${celebrationText}`);
      }

      // ファクト0件でも仮説モードで生成を続行（ハードエラーにしない）
      if (hasTargetUrl && factsForLetter.length === 0) {
        devLog.warn('URL provided but no facts extracted. Proceeding in hypothesis mode.');
      }

      // ファクトの数値/固有名詞有無を判定
      const hasFactNumbers = factsForLetter.some(f => f.category === 'numbers') ||
        (analysis_result.extracted_facts?.numbers?.length ?? 0) > 0;
      const hasProperNouns = factsForLetter.some(f => f.category === 'properNouns') ||
        (analysis_result.extracted_facts?.properNouns?.length ?? 0) > 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        devLog.log(`Generation attempt ${attempt}/${maxAttempts}`);

        try {
          // 1. プロンプト構築
          const prompt = buildGenerationPrompt(
            analysis_result,
            user_overrides,
            sender_info,
            mode,
            output_format,
            factsForLetter,
            attempt > 1 ? improvementPoints : undefined,
            hasTargetUrl,
            isPublicSector,
            isStartup,
            celebrationText
          );

          // 2. 生成
          const result = await generateJson({
            prompt,
            schema: GenerateV2OutputSchema,
            maxRetries: 2,
            temperature: TEMPERATURE.generation,
          });

          // 2.5. ポストプロセス: 禁止ワード・プレースホルダーの自動置換
          result.body = postProcessLetterBody(result.body, mode);
          // バリエーションもポストプロセス
          if (result.variations) {
            result.variations.standard = postProcessLetterBody(result.variations.standard, mode);
            result.variations.emotional = postProcessLetterBody(result.variations.emotional, mode);
            result.variations.consultative = postProcessLetterBody(result.variations.consultative, mode);
          }

          // 3. qualityGate 検証
          // eventモードはプレースホルダー禁止なのでcomplete扱い（validateLetterOutput用）
          const validationMode = mode === 'event' ? 'complete' : mode;
          const validation = validateLetterOutput(result.body, proofPoints, {
            mode: validationMode,
            hasProofPoints: analysis_result.proof_points.length > 0,
            hasRecentNews: analysis_result.recent_news.length > 0,
            eventPosition: user_overrides?.event_position,
          });

          // 4. 詳細スコア計算（factsForLetter を使用）
          // モード別に専用スコアを使用
          let detailedScore: { total: number; suggestions: string[]; breakdown?: Record<string, number> };

          if (mode === 'event') {
            const eventScore = calculateEventQualityScore(
              result.body,
              user_overrides?.event_position
            );
            detailedScore = {
              total: eventScore.total,
              suggestions: eventScore.issues,
              breakdown: eventScore.penalties as unknown as Record<string, number>,
            };
            devLog.log(`Event quality score: ${eventScore.total}, penalties:`, eventScore.penalties);
          } else {
            // userInput はユーザーが入力した追加コンテキスト
            const userInput = user_overrides?.additional_context || '';
            const standardScore = calculateDetailedScore(
              result.body,
              hasFactNumbers,
              hasProperNouns,
              factsForLetter,
              hasTargetUrl,
              userInput,
              proofPoints
            );
            detailedScore = {
              total: standardScore.total,
              suggestions: standardScore.suggestions,
              breakdown: standardScore.breakdown as unknown as Record<string, number>,
            };
            devLog.log(`Detailed score: ${standardScore.total}, breakdown:`, standardScore.breakdown);
          }

          // 品質OK（80点以上）または最終試行
          if (detailedScore.total >= 80 || attempt === maxAttempts) {
            devLog.log(`Returning result (score: ${detailedScore.total}, attempt: ${attempt})`);

            // Phase 6: citationsを整形（sourceUrlをfactsForLetterから必ず補完）
            const citations: Citation[] = (result.citations || []).map(c => {
              const matchingFact = factsForLetter.find(f => f.quoteKey === c.quoteKey);
              return {
                sentence: c.sentence,
                quoteKey: c.quoteKey,
                // sourceUrlは必ずfactsForLetterから取得（空ならmatchingFactから補完）
                sourceUrl: c.sourceUrl || matchingFact?.sourceUrl || undefined,
                sourceTitle: c.sourceTitle || matchingFact?.sourceTitle || undefined,
              };
            });

            return NextResponse.json({
              success: true,
              data: {
                subjects: result.subjects,
                body: result.body,
                rationale: result.rationale,
                quality: {
                  score: detailedScore.total,
                  passed: detailedScore.total >= 80 && validation.ok,
                  issues: [...validation.reasons, ...detailedScore.suggestions],
                  evaluation_comment: mode === 'event'
                    ? `Event quality score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`
                    : `Detailed score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`,
                },
                variations: result.variations,
                // 追加フィールド
                sources: analysis_result.sources || [],
                factsForLetter: factsForLetter,
                citations,  // Phase 6: citations追加
              },
            });
          }

          // リライト用改善ポイント収集
          improvementPoints = detailedScore.suggestions;
          if (validation.reasons.length > 0) {
            improvementPoints = [...improvementPoints, ...validation.reasons.slice(0, 2)];
          }
          improvementPoints = improvementPoints.slice(0, 3); // 最大3つ

          // 次の試行のために結果を保存
          bestResult = result;
          bestQuality = {
            score: detailedScore.total,
            passed: false,
            issues: [...validation.reasons, ...detailedScore.suggestions],
            evaluation_comment: `Attempt ${attempt} - score ${detailedScore.total}/100, retrying`,
          };

        } catch (error) {
          devLog.error(`Generation attempt ${attempt} failed:`, error);
          if (attempt === maxAttempts) {
            // 最終試行も失敗した場合
            if (bestResult) {
              // 前の試行の結果があれば返却
              // Phase 6: citationsを整形（sourceUrlをfactsForLetterから必ず補完）
              const citations: Citation[] = (bestResult.citations || []).map(c => {
                const matchingFact = factsForLetter.find(f => f.quoteKey === c.quoteKey);
                return {
                  sentence: c.sentence,
                  quoteKey: c.quoteKey,
                  sourceUrl: c.sourceUrl || matchingFact?.sourceUrl || undefined,
                  sourceTitle: c.sourceTitle || matchingFact?.sourceTitle || undefined,
                };
              });

              // Phase 6: sourcesにextractedFactsを追加
              const enrichedSources = enrichSourcesWithFacts(
                analysis_result.sources || [],
                factsForLetter
              );

              return NextResponse.json({
                success: true,
                data: {
                  subjects: bestResult.subjects,
                  body: bestResult.body,
                  rationale: bestResult.rationale,
                  quality: bestQuality,
                  variations: bestResult.variations,
                  sources: enrichedSources,
                  factsForLetter: factsForLetter,
                  citations,  // Phase 6: citations追加
                },
              });
            }
            // 結果がない場合はエラー
            return NextResponse.json(
              { success: false, error: '生成に失敗しました', code: 'GENERATION_FAILED' },
              { status: 500 }
            );
          }
        }
      }

      // ここには到達しないはず
      return NextResponse.json(
        { success: false, error: '生成に失敗しました', code: 'GENERATION_FAILED' },
        { status: 500 }
      );
    },
    {
      requireAuth: false,
      rateLimit: { windowMs: 60000, maxRequests: 20 },
    }
  );
}
