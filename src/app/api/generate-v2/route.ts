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
  calculateConsultingQualityScore,
  type ProofPoint,
} from '@/lib/qualityGate';
import { selectFactsForLetter, isPublicSectorOrg, isStartupCompany, detectCelebrationFromFacts, enrichSourcesWithFacts } from '@/lib/factSelector';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { SAMPLE_SENDER_COMPANIES } from '@/lib/sampleData';
import { devLog } from '@/lib/logger';
import type { AnalysisResult, SelectedFact } from '@/types/analysis';
import {
  GenerateV2RequestSchema,
  GenerateV2OutputSchema,
  ConsultingOutputSchema,
  type SenderInfo,
  type UserOverrides,
  type GenerateV2Output,
  type ConsultingOutput,
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
 * 相談型レター（consulting）モード専用のプロンプトを構築
 */
function buildConsultingPrompt(
  analysis: AnalysisResult,
  overrides: UserOverrides | undefined,
  sender: SenderInfo,
  factsForLetter: SelectedFact[] = [],
  improvementPoints?: string[],
  _hasTargetUrl: boolean = false,
  isPublicSector: boolean = false
): string {
  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = overrides?.person_name || analysis.facts.person_name || '';
  const personPosition = overrides?.person_position || analysis.facts.person_position || '';

  // リライト時の改善指示
  let retryInstruction = '';
  if (improvementPoints && improvementPoints.length > 0) {
    retryInstruction = `\n\n【リライト注意】前回の生成は品質基準を満たしませんでした。以下の点を改善してください：
${improvementPoints.map(p => `- ${p}`).join('\n')}`;
  }

  // 選定ファクトの引用指示
  let factsInstruction = '';
  if (factsForLetter.length > 0) {
    const factsList = factsForLetter.map(f =>
      `- [${f.category}] ${f.quoteKey}: ${f.content}${f.sourceUrl ? ` (出典: ${f.sourceUrl})` : ''}`
    ).join('\n');
    factsInstruction = `\n\n【必須引用ファクト（冒頭2行で必ず1つ以上使用）】
${factsList}`;
  }

  // 証拠ポイント
  const proofPointsList = analysis.proof_points.length > 0
    ? analysis.proof_points.map(p => `- [${p.type}] ${p.content} (確度: ${p.confidence})`).join('\n')
    : '（証拠ポイントなし）';

  // 追加コンテキスト
  const additionalContext = overrides?.additional_context || '';

  // 宛名
  const recipientFormat = personName
    ? `${companyName} ${personPosition} ${personName}様`
    : companyName
    ? `${companyName} ${personPosition || 'ご担当者'}様`
    : '';

  // citations出力指示
  const citationInstruction = factsForLetter.length > 0
    ? `\n\n【citations出力ルール】
- bodyの中でfactsForLetterを引用した文ごとにcitationを出力
- sentenceは引用を含む1文（最大50文字、省略は「...」）
- quoteKeyはfactsForLetterのquoteKeyと一致させる
- body本文に「[citation:...]」等のマーカーは絶対に入れないこと`
    : '';

  // 公共機関向け指示
  const publicSectorInstruction = isPublicSector ? buildPublicSectorInstructions() : '';

  return `あなたは大手企業のCxO（経営層）から「15分だけ話を聞こう」を引き出すことに長けた、トップクラスのBDR（ビジネス開発担当）です。
以下の分析結果を基に、相談型レター（メール）を作成してください。${retryInstruction}${factsInstruction}${citationInstruction}${publicSectorInstruction}

【相談型レター - 絶対ルール（厳守）】

■ 冒頭ルール
- 型で始めない。「突然のご連絡失礼いたします」は禁止
- 冒頭2行で相手の公開ファクトに触れ、経営テーマに接続する
- 宛名: 「${recipientFormat || '【企業名】【役職】【氏名】様'}」で始め、その直後にファクト引用

■ 構造ルール
- 2段落目で論点を1つに絞り、断定せず質問形にする
  - OK: 「御社ではこの点についてどのような状況でしょうか」
  - NG: 「貴社では〇〇が課題です」「推察します」
- 価値提案はアウトカムで1行 + できること2つ（箇条書き可）
- 15分の理由を明確に書く（例: 「論点チェックリストを持参し、現状の優先度だけ確認させてください」）

■ CTAルール（2択、二重取り禁止）
- 2択CTAで終わる:
  1. 「来週15分ほど、オンラインで論点の優先度だけ確認させてください」（具体的な時間枠+形式+ハードルの低い目的）
  2. 「まずは要点資料だけお送りします」
- NG: 「資料をお送りします」と「15分ください」の両方を入れる（二重取り）
- NG: 「ぜひ一度お話しさせてください」（曖昧すぎる）
- NG: 「ご検討のほどお願いいたします」（アクション不明確）
- 必須: 時間枠（15分/30分）、形式（オンライン/お電話等）、期限（来週/今月中等）を含める

■ 文字数・文体
- 700-900文字（1文を短く、敬意は厚く、売り込み臭は薄く）
- すべての文は「です」「ます」「でしょうか」「ください」で終える
- 体言止め禁止

■ 禁止ワード【HARD NO】
- 「推察します」「確信しております」「言われています」
- 抽象語のみで構成された段落（必ず具体ファクトか数字を1つ以上含める）
- 競合名は入力に明示されている場合のみ言及可

■ 差出人
- 署名: ${sanitizeForPrompt(sender.name, 100)}（${sanitizeForPrompt(sender.company_name, 200)}${sender.department ? ` ${sanitizeForPrompt(sender.department, 200)}` : ''}）

【ターゲット情報】
企業名: ${sanitizeForPrompt(companyName, 200) || '（未指定）'}
担当者名: ${sanitizeForPrompt(personName, 100) || '（未指定）'}
役職: ${sanitizeForPrompt(personPosition, 100) || '（未指定）'}
業界: ${analysis.facts.industry || '（未指定）'}

【活用できる証拠】
${proofPointsList}

【差出人サービス概要】
${sanitizeForPrompt(sender.service_description, 1000)}

${additionalContext ? `【追加コンテキスト】\n${sanitizeForPrompt(additionalContext, 1000)}` : ''}

${overrides?.cxo_insight ? `【CxO個人の発信情報（最重要 — 必ずレターに反映すること）】
以下はターゲットCxO個人の発信内容です。レターの冒頭で必ずこの情報に触れ、「あなた個人のことを理解しています」というメッセージを伝えてください:
${sanitizeForPrompt(overrides.cxo_insight, 1000)}` : ''}

${overrides?.mutual_connection ? `【共通の接点（レターの冒頭で必ず言及すること）】
以下の共通の接点情報を、レターの最初の1-2文で自然に言及してください。この情報はレターの返信率に最も影響します:
${sanitizeForPrompt(overrides.mutual_connection, 500)}` : ''}

【出力形式】
以下のJSON形式で出力してください：
{
  "subject": "件名（25文字目安、相手の関心に寄せる）",
  "body": "本文テキスト（700-900文字）",
  "selfCheck": [
    "チェック1: 冒頭2行で公開ファクトに触れているか",
    "チェック2: 論点が1つに絞られ質問形になっているか",
    "チェック3: 2択CTAで終わっているか"
  ]${factsForLetter.length > 0 ? `,
  "citations": [
    {
      "sentence": "〜を拝見しました...",
      "quoteKey": "factsForLetterのquoteKey"
    }
  ]` : ''}
}`;
}

/**
 * 生成プロンプトを構築
 */
function buildGenerationPrompt(
  analysis: AnalysisResult,
  overrides: UserOverrides | undefined,
  sender: SenderInfo,
  mode: 'draft' | 'complete' | 'event' | 'consulting',
  format: 'letter' | 'email',
  factsForLetter: SelectedFact[] = [],
  improvementPoints?: string[],
  hasTargetUrl: boolean = false,
  isPublicSector: boolean = false,
  isStartup: boolean = false,
  celebrationText: string = ''
): string {
  // consultingモードは専用プロンプトを使用
  if (mode === 'consulting') {
    return buildConsultingPrompt(analysis, overrides, sender, factsForLetter, improvementPoints, hasTargetUrl, isPublicSector);
  }

  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = overrides?.person_name || analysis.facts.person_name || '';
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

  // 品質強化ルール（CxOレター必須）
  const qualityEnhancementRules = `
【品質ルール（違反時リライト）】

■ 禁止表現【HARD NO】
推察/想定/断定/感銘/統一されておらず/残存/課題が生じている
→ 代替: 「〜が論点になりやすいです」「御社の現状を伺い」

■ テーマ接続: フックと提案テーマを1文で橋渡し（ワープ禁止）
■ ベネフィット: メイン1本+補助線1本（並列禁止）
■ 宛名: 個人名あり→「社名 氏名様」、なし→「社名 ご担当者様」
■ プレースホルダー禁止(完成モード): 「〇〇」「●●」「【要確認】」不可。数値不明なら文ごと削る

【レター品質基準（必ず参照）】

良いレター例（このレベルを目指す）:
---
貴社が本年度の統合報告書にて開示された「サプライチェーン全体のCO2排出量30%削減」という目標に注目しております。Scope3の削減には、調達・出張・経費に関わる全プロセスの可視化が必要であり、特に間接材購買と出張費の排出量算定は多くの企業が課題を抱えている領域です。
弊社は、経費精算データとCO2排出量を自動で紐づけるソリューションを提供しており、御社と同規模の製造業A社では、導入6ヶ月でScope3カテゴリ6・7の算定工数を70%削減されました。
来週のご都合のよい日に、15分ほどオンラインで事例をご共有できればと存じます。
---
→ 良い理由: 1.冒頭が相手の具体的取り組み(Why you) 2.「統合報告書」で時期明確(Why now) 3.課題特定→自社接続(Bridge) 4.匿名だが具体数値(Proof) 5.CTA具体的(来週/15分/オンライン)

悪いレター例（このパターンを避ける）:
---
弊社は経費精算のクラウドソリューションを提供しております。貴社におかれましても、業務効率化やDX推進に取り組まれていることと存じます。弊社のソリューションは多くの企業様にご導入いただいており、ぜひ一度ご紹介させてください。
---
→ 悪い理由: 1.冒頭が自社紹介(読む気が失せる) 2.「DX推進」は全企業に当てはまる一般論 3.「多くの企業」で実績が曖昧 4.「ぜひ一度」でCTA具体性ゼロ
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

    bridgeInstruction = `\n\n【ブリッジ構造（必須）】
冒頭200文字以内に以下の流れを必ず含めること：
1. フック: ファクト引用（「貴社が〜」「〜を拝見し」）
2. ブリッジ文: ファクトと提案テーマをつなぐ1文
3. 仮説: 「〜ではないでしょうか」で提示

参考ブリッジ理由:
${bridgeReasons || '（ブリッジ理由なし）'}`;
  }

  // 選定ファクトの必須引用指示（Phase 6強化版）
  let factsForLetterInstruction = '';
  if (factsForLetter.length > 0) {
    const factsList = factsForLetter.map(f =>
      `- ${f.quoteKey}: ${f.content}`
    ).join('\n');
    factsForLetterInstruction = `\n\n【必須引用ファクト（冒頭200文字以内に1つ以上使用）】
${factsList}

一般論禁止: CASE/MaaS/100年に一度/急務/喫緊/多くの企業では/一般的に/近年では — 使用不可`;
  }

  // エビデンスルール（仮説モード統合）
  let evidenceRule = `\n\n【エビデンスルール】
架空の数字・社名・実績は禁止。提供データのみ使用可。断定→仮説形式に。`;

  if (!hasTargetUrl || factsForLetter.length === 0) {
    evidenceRule += `
【仮説モード適用】具体数字・固有名詞は不可。すべて「〜ではないでしょうか」「〜とお見受けいたします」形式。業界傾向は「〜業界では〜という傾向があると聞きます」の形式。`;
  }

  // 冒頭の宛名フォーマット
  const recipientFormat = personName
    ? `${companyName} ${personPosition} ${personName}様`
    : companyName
    ? `${companyName} ${personPosition || 'ご担当者'}様`
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

  return `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
以下の分析結果を基に、${format === 'email' ? 'メール' : '手紙'}を作成してください。

${modeInstruction}${eventModeInstructions}${qualityEnhancementRules}${retryInstruction}${bridgeInstruction}${factsForLetterInstruction}${evidenceRule}${citationInstruction}${publicSectorInstruction}${startupToneInstruction}${celebrationInstruction}

【絶対ルール】
1. 架空禁止。提供データのみ使用可
2. 儀礼的褒め言葉禁止（「感銘を受けました」等）
3. 視点: ガバナンス強化/経営スピード向上/リスク低減（業務効率化/コスト削減NG）
4. 350-500文字。体言止め禁止（「です」「ます」で終える）
5. 冒頭: 「${recipientFormat || '【企業名】【役職】【氏名】様'}」
6. 構造: フック→課題仮説→解決策→実績→CTA

【CTA（ネクストステップ）の書き方 — 厳守】
良い例:
- 「来週〇曜日に15分ほど、オンラインで情報交換の機会をいただけませんでしょうか」
- 「今月中に30分ほど、貴社の課題感をお聞かせいただける機会を頂戴できれば幸いです」
悪い例（避ける）:
- 「ぜひ一度お話しさせてください」→ 曖昧すぎる
- 「ご検討のほどお願いいたします」→ アクションが不明確
ルール:
1. 具体的な時間枠を提示する（15分、30分等）
2. 形式を明示する（オンライン、お電話、ご訪問等）
3. 期限を匂わせる（来週、今月中等）
4. ハードルを下げる（「情報交換」「事例共有」等）

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

【提案された構成】
- タイミングの理由: ${analysis.hypotheses.timing_reason}
- 課題仮説: ${analysis.hypotheses.challenge_hypothesis}
- 提供価値: ${analysis.hypotheses.value_proposition}
- CTA提案: ${analysis.hypotheses.cta_suggestion}

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
{
  "subjects": ["件名候補1（25文字目安、抽象語禁止）", "件名候補2", "件名候補3", "件名候補4", "件名候補5"],
  "body": "本文テキスト（350-500文字）",
  "rationale": [
    { "type": "timing", "content": "今連絡する理由" },
    { "type": "evidence", "content": "使用した証拠" },
    { "type": "value", "content": "提供価値" }
  ],
  "variations": {
    "standard": "王道パターン（業界トレンド仮説リード）",
    "emotional": "熱意パターン（具体的成功事例リード）",
    "consultative": "課題解決パターン（リスク・規制観点リード）"
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
function postProcessLetterBody(body: string, mode: 'draft' | 'complete' | 'event' | 'consulting'): string {
  let processed = body;

  // 1. 推察系の自動置換（complete/consulting/eventモード）
  if (mode !== 'draft') {
    processed = processed.replace(/推察いたします/g, 'ではないでしょうか');
    processed = processed.replace(/推察します/g, 'ではないでしょうか');
    processed = processed.replace(/と推察しております/g, 'ではないかと存じます');
    processed = processed.replace(/と推察/g, 'ではないかと');
    processed = processed.replace(/想定されます/g, 'ではないでしょうか');
    processed = processed.replace(/と想定しております/g, 'ではないかと存じます');
  }

  // 2. プレースホルダーの除去（complete/event/consultingモード）
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

      // Pro機能の認可チェック（complete/event/consultingはPro以上が必要）
      const PRO_MODES = ['complete', 'event', 'consulting'] as const;
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

          // 2. 生成（consultingモードは専用スキーマ）
          const isConsulting = mode === 'consulting';
          const result = isConsulting
            ? await (async () => {
                const consultingResult = await generateJson({
                  prompt,
                  schema: ConsultingOutputSchema,
                  maxRetries: 2,
                  temperature: TEMPERATURE.generation,
                }) as ConsultingOutput;
                // GenerateV2Output互換に変換
                return {
                  subjects: [consultingResult.subject],
                  body: consultingResult.body,
                  rationale: [{ type: 'selfCheck', content: consultingResult.selfCheck.join(' / ') }],
                  citations: consultingResult.citations,
                  // consulting固有データを保持
                  _selfCheck: consultingResult.selfCheck,
                } as GenerateV2Output & { _selfCheck: string[] };
              })()
            : await generateJson({
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
          // event/consultingモードはプレースホルダー禁止なのでcomplete扱い（validateLetterOutput用）
          const validationMode = mode === 'event' ? 'complete' : mode === 'consulting' ? 'consulting' : mode;
          const validation = validateLetterOutput(result.body, proofPoints, {
            mode: validationMode,
            minChars: isConsulting ? 700 : undefined,
            maxChars: isConsulting ? 900 : undefined,
            hasProofPoints: analysis_result.proof_points.length > 0,
            hasRecentNews: analysis_result.recent_news.length > 0,
            eventPosition: user_overrides?.event_position,
          });

          // 4. 詳細スコア計算（factsForLetter を使用）
          // モード別に専用スコアを使用
          let detailedScore: { total: number; suggestions: string[]; breakdown?: Record<string, number> };

          if (mode === 'consulting') {
            const consultingScore = calculateConsultingQualityScore(result.body);
            detailedScore = {
              total: consultingScore.total,
              suggestions: consultingScore.issues,
              breakdown: consultingScore.penalties as unknown as Record<string, number>,
            };
            devLog.log(`Consulting quality score: ${consultingScore.total}, penalties:`, consultingScore.penalties);
          } else if (mode === 'event') {
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
              userInput
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
                  evaluation_comment: mode === 'consulting'
                    ? `Consulting quality score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`
                    : mode === 'event'
                    ? `Event quality score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`
                    : `Detailed score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`,
                },
                variations: result.variations,
                // 追加フィールド
                sources: analysis_result.sources || [],
                factsForLetter: factsForLetter,
                citations,  // Phase 6: citations追加
                // consulting固有フィールド
                ...(isConsulting && '_selfCheck' in result ? { selfCheck: (result as GenerateV2Output & { _selfCheck: string[] })._selfCheck } : {}),
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
