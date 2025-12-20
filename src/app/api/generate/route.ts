import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
}

// Googleプロバイダーを初期化（APIキーを明示的に渡す）
const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

// 入力スキーマ定義
const GenerateSchema = z.object({
  myCompanyName: z.string().optional(),
  myName: z.string().optional(),
  myServiceDescription: z.string().optional(),
  companyName: z.string().optional(),
  position: z.string().optional(),
  name: z.string().optional(),
  background: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  caseStudy: z.string().optional(),
  offer: z.string().optional(),
  freeformInput: z.string().optional(),
  model: z.enum(['flash', 'pro']).default('flash'),
  mode: z.enum(['sales', 'event']).default('sales'),
  inputComplexity: z.enum(['detailed', 'simple']).default('detailed'),
  eventUrl: z.string().optional(),
  eventName: z.string().optional(),
  eventDateTime: z.string().optional(),
  eventSpeakers: z.string().optional(),
  invitationReason: z.string().optional(),
  simpleRequirement: z.string().optional(),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    GenerateSchema,
    async (data, user) => {
      try {
        const {
          myCompanyName,
          myName,
          myServiceDescription,
          companyName,
          position,
          name,
          background,
          problem,
          solution,
          caseStudy,
          offer,
          freeformInput,
          model = 'flash',
          mode = 'sales',
          inputComplexity = 'detailed',
          eventUrl,
          eventName,
          eventDateTime,
          eventSpeakers,
          invitationReason,
          simpleRequirement,
        } = data;

    // モデル選択
    const modelName = model === 'pro' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';
    const geminiModel = google(modelName);

    // かんたんモードの場合（セールスモードのみ）
    if (mode === 'sales' && inputComplexity === 'simple') {
      const prompt = `あなたはCxO向けセールスレターの専門家です。
以下の最小限の情報から、経営層に「会いたい」と思わせる営業手紙を作成してください。

【提供された情報】
ターゲット企業名: ${companyName}
自社サービス概要: ${myServiceDescription}
${simpleRequirement ? `伝えたい要件: ${simpleRequirement}` : ''}

【あなたの役割】
提供された情報が少ないため、以下の要素をAIが推測・補完して、完全なCxOレターを作成してください。

【補完すべき要素】
1. 背景・フック: ${companyName}の業界や事業内容から推測される最近の話題やトレンド
2. 課題の指摘: ${companyName}が属する業界で一般的に抱える課題
3. 解決策の提示: ${myServiceDescription}がその課題をどう解決できるか
4. 事例・実績: サービスの一般的な成果や効果（具体的な企業名は不要）
5. オファー: ${simpleRequirement || '情報交換や打ち合わせ'}を目的とした具体的なアクション

【作成ルール】
- CxOレターの5要素（背景・課題・解決策・実績・オファー）を必ず含めること
- 文字数: 800〜1000文字程度
- トーン: 丁寧だが堅苦しくない、ビジネスライク
- 推測した内容でも、自信を持って具体的に書くこと（「〜かもしれません」ではなく断定的に）
- 一般論に終始せず、${companyName}に対する具体的な提案として書くこと
- 宛名は「${companyName} ご担当者様」で始める
- 末尾は「${myServiceDescription}を提供している者より」で締める

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

それでは、手紙本文を作成してください。`;

      const result = await generateText({
        model: geminiModel,
        prompt: prompt,
      });
      const letter = result.text;
      return NextResponse.json({ letter });
    }

    // イベント招待モード（まとめて入力）の場合
    if (mode === 'event' && inputComplexity === 'simple') {
      const prompt = `あなたはイベント招待状の専門家です。
以下の最小限の情報から、魅力的で具体的なイベント招待状を作成してください。

【提供された情報】
イベントURL: ${eventUrl || '情報なし'}
${eventName ? `イベント名: ${eventName}` : ''}
${eventDateTime ? `開催日時・場所: ${eventDateTime}` : ''}
${eventSpeakers ? `主要登壇者/ゲスト: ${eventSpeakers}` : ''}
ターゲット企業名: ${companyName}
${invitationReason ? `誘いたい理由・メモ: ${invitationReason}` : ''}

【差出人（自社）情報】
会社名: ${myCompanyName || '（記載なし）'}
氏名: ${myName || '（記載なし）'}

【あなたの役割】
提供されたイベント情報と招待の理由から、以下を構成してください：
1. **イベントの価値**: イベントの内容から、ターゲット企業にとってのメリットを具体的に説明
2. **招待の必然性（Why You?）**: なぜこの企業・担当者を招待したいのか、誘いたい理由メモを活用して説得力ある理由を構成
3. **具体的なアクション**: 参加を促すクロージング

【作成ルール】
- 構成:
  1. 特別なお誘いであることの提示
  2. イベントの価値（登壇者、テーマの魅力）
  3. なぜ貴社を招待したいのか（メモを活用）
  4. イベント詳細（日時・場所・URL）
  5. 参加へのアクション
- 文字数: 600〜900文字程度
- トーン: 丁寧かつ相手の時間を尊重
- 売り込み感を抑え、相手にとっての価値を前面に
- 宛名は「${companyName} ご担当者様」で始める
- 末尾は「${myCompanyName || '主催者'}${myName ? '\n' + myName : ''}」で締める

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

それでは、イベント招待状の本文を作成してください。`;

      const result = await generateText({
        model: geminiModel,
        prompt: prompt,
      });
      const letter = result.text;
      return NextResponse.json({ letter });
    }

    // イベント招待モード（ステップ入力）の場合
    if (mode === 'event') {
      const prompt = `あなたはイベント招待状の専門家です。
以下の情報を基に、丁寧でありながらも相手の時間を尊重した、魅力的なイベント招待状を作成してください。

【差出人（自社）情報】
会社名: ${myCompanyName}
氏名: ${myName}
自社について: ${myServiceDescription}

【招待先情報】
企業名: ${companyName}
役職: ${position || ''}
氏名: ${name}

【イベント情報】
イベント名: ${eventName}
開催日時・場所: ${eventDateTime}
主要登壇者/ゲスト: ${eventSpeakers || 'なし'}
イベントURL: ${eventUrl || 'なし'}

【招待の背景（Why You?）】
${invitationReason}

【作成ルール】
- 構成:
  1. 特別なお誘いであることの提示（一斉配信ではない雰囲気）
  2. イベントの価値（対象者にとってのメリット、登壇者の魅力）
  3. なぜ貴殿を招待したか（招待の背景を活用）
  4. 物流情報（日時・場所・URL）
  5. オファー（席を確保している、ぜひ来てほしい等の熱意）
- 文字数: 600〜900文字程度
- トーン: 丁寧かつ、相手の時間を尊重したもの
- 売り込み感を抑え、相手にとっての価値を前面に
- 宛名は「${companyName} ${position ? position + ' ' : ''}${name}様」で始める
- 末尾は「${myCompanyName}\n${myName}」で締める

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
  * 例: イベントURL: https://...
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

それでは、イベント招待状の本文を作成してください。`;

      const result = await generateText({
        model: geminiModel,
        prompt: prompt,
      });
      const letter = result.text;
      return NextResponse.json({ letter });
    }

    // まとめて入力モードの場合（セールスモード）
    if (freeformInput) {
      const prompt = `あなたはCxO向けセールスレターの専門家です。
提供されたテキストから、CxOレターの5つの要素（背景・課題・解決策・実績・オファー）を抽出し、形式に沿って営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${myCompanyName}
氏名: ${myName}
サービス概要: ${myServiceDescription}

【ターゲット情報】
企業名: ${companyName}
役職: ${position || '経営者'}
氏名: ${name}

【提供されたテキスト】
${freeformInput}

【作成ルール】
- 提供されたテキストから、以下の5要素を抽出・再構成すること：
  1. 背景・フック（なぜ今、その企業にアプローチするのか）
  2. 課題の指摘（業界や企業の課題）
  3. 解決策の提示（自社サービスによる解決策）
  4. 事例・実績（具体的な成果）
  5. オファー（具体的なアクション）
- 文字数: 800〜1200文字程度
- トーン: 丁寧だが堅苦しくない、ビジネスライク
- 売り込み感を抑え、価値提供を前面に出す
- 具体的で、読み手の状況に寄り添った内容にする
- 宛名は「${companyName} ${position ? position + ' ' : ''}${name}様」で始める
- 末尾は「${myCompanyName}\n${myName}」で締める

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

それでは、手紙本文を作成してください。`;

      const result = await generateText({
        model: geminiModel,
        prompt: prompt,
      });
      const letter = result.text;
      return NextResponse.json({ letter });
    }

    // ステップ入力モードの場合（従来のロジック）
    const prompt = `あなたはCxO向けセールスレターの専門家です。
以下の情報を基に、経営層に「会いたい」と思わせる営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${myCompanyName}
氏名: ${myName}
サービス概要: ${myServiceDescription}

【ターゲット情報】
企業名: ${companyName}
役職: ${position || '経営者'}
氏名: ${name}

【手紙の構成要素（5つの要素）】
1. 背景・フック: ${background}
2. 課題の指摘: ${problem}
3. 解決策の提示: ${solution}
4. 事例・実績: ${caseStudy}
5. オファー: ${offer}

【作成ルール】
- 上記5要素を必ず含めること
- 文字数: 800〜1200文字程度
- トーン: 丁寧だが堅苦しくない、ビジネスライク
- 売り込み感を抑え、価値提供を前面に出す
- 具体的で、読み手の状況に寄り添った内容にする
- 自社サービス概要を踏まえた、具体的な提案を含める
- 宛名は「${companyName} ${position ? position + ' ' : ''}${name}様」で始める
- 末尾は「${myCompanyName}\n${myName}」で締める

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

それでは、手紙本文を作成してください。`;

        const result = await generateText({
          model: geminiModel,
          prompt: prompt,
        });
        const letter = result.text;

        return NextResponse.json({ letter });
      } catch (error) {
        console.error('生成エラー:', error);
        return NextResponse.json(
          { error: '手紙の生成に失敗しました' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: {
        windowMs: 60000,
        maxRequests: 20,
      },
    }
  );
}
