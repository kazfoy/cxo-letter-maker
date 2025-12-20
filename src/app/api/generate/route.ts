import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt, detectInjectionAttempt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';

export const maxDuration = 60;

let googleProvider: any = null;

function getGoogleProvider() {
  if (googleProvider) return googleProvider;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
  }

  googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });
  return googleProvider;
}

// 入力スキーマ定義（文字数制限を追加）
const GenerateSchema = z.object({
  myCompanyName: z.string().max(200, '会社名は200文字以内で入力してください').optional(),
  myName: z.string().max(100, '氏名は100文字以内で入力してください').optional(),
  myServiceDescription: z.string().max(2000, 'サービス概要は2000文字以内で入力してください').optional(),
  companyName: z.string().max(200, '企業名は200文字以内で入力してください').optional(),
  position: z.string().max(100, '役職は100文字以内で入力してください').optional(),
  name: z.string().max(100, '氏名は100文字以内で入力してください').optional(),
  background: z.string().max(2000, '背景は2000文字以内で入力してください').optional(),
  problem: z.string().max(2000, '課題は2000文字以内で入力してください').optional(),
  solution: z.string().max(2000, '解決策は2000文字以内で入力してください').optional(),
  caseStudy: z.string().max(2000, '事例は2000文字以内で入力してください').optional(),
  offer: z.string().max(1000, 'オファーは1000文字以内で入力してください').optional(),
  freeformInput: z.string().max(5000, '自由入力は5000文字以内で入力してください').optional(),
  model: z.enum(['flash', 'pro']).default('flash'),
  mode: z.enum(['sales', 'event']).default('sales'),
  inputComplexity: z.enum(['detailed', 'simple']).default('detailed'),
  eventUrl: z.string().max(500, 'URLは500文字以内で入力してください').optional(),
  eventName: z.string().max(200, 'イベント名は200文字以内で入力してください').optional(),
  eventDateTime: z.string().max(200, '日時・場所は200文字以内で入力してください').optional(),
  eventSpeakers: z.string().max(1000, '登壇者情報は1000文字以内で入力してください').optional(),
  invitationReason: z.string().max(2000, '招待理由は2000文字以内で入力してください').optional(),
  simpleRequirement: z.string().max(1000, '要件は1000文字以内で入力してください').optional(),
});

// ヘルパー関数: フォールバック付きで生成を実行
async function generateWithFallback(prompt: string, primaryModelName: string = 'gemini-2.0-flash-exp') {
  const google = getGoogleProvider();
  const primaryModel = google(primaryModelName);
  // フォールバックは安定版の 1.5-flash
  const fallbackModel = google('gemini-1.5-flash');

  try {
    return await generateText({
      model: primaryModel,
      prompt: prompt,
    });
  } catch (error) {
    devLog.warn(`Primary model ${primaryModelName} failed, trying fallback to gemini-1.5-flash...`, error);
    try {
      return await generateText({
        model: fallbackModel,
        prompt: prompt,
      });
    } catch (fallbackError) {
      // 両方失敗した場合は、元のエラー（または最後のあがきでfallbackError）を投げる
      // ここでは詳細なエラー情報を呼び出し元に伝えるためにfallbackErrorを投げる
      throw fallbackError;
    }
  }
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    GenerateSchema,
    async (data, user) => {
      try {
        // プロンプトインジェクション検出
        const inputValues = Object.values(data).filter(v => typeof v === 'string');
        for (const value of inputValues) {
          if (detectInjectionAttempt(value)) {
            devLog.warn('Prompt injection attempt detected');
            return NextResponse.json(
              {
                error: '不正な入力が検出されました',
                code: 'SECURITY_ERROR',
                message: '入力内容にセキュリティ上の問題がある可能性があります。'
              },
              { status: 400 }
            );
          }
        }

        // 入力をサニタイズ
        const {
          myCompanyName = '',
          myName = '',
          myServiceDescription = '',
          companyName = '',
          position = '',
          name = '',
          background = '',
          problem = '',
          solution = '',
          caseStudy = '',
          offer = '',
          freeformInput = '',
          model = 'flash',
          mode = 'sales',
          inputComplexity = 'detailed',
          eventUrl = '',
          eventName = '',
          eventDateTime = '',
          eventSpeakers = '',
          invitationReason = '',
          simpleRequirement = '',
        } = data;

        // 全ての文字列入力をサニタイズ
        const safe = {
          myCompanyName: sanitizeForPrompt(myCompanyName, 200),
          myName: sanitizeForPrompt(myName, 100),
          myServiceDescription: sanitizeForPrompt(myServiceDescription, 2000),
          companyName: sanitizeForPrompt(companyName, 200),
          position: sanitizeForPrompt(position, 100),
          name: sanitizeForPrompt(name, 100),
          background: sanitizeForPrompt(background, 2000),
          problem: sanitizeForPrompt(problem, 2000),
          solution: sanitizeForPrompt(solution, 2000),
          caseStudy: sanitizeForPrompt(caseStudy, 2000),
          offer: sanitizeForPrompt(offer, 1000),
          freeformInput: sanitizeForPrompt(freeformInput, 5000),
          eventUrl: sanitizeForPrompt(eventUrl, 500),
          eventName: sanitizeForPrompt(eventName, 200),
          eventDateTime: sanitizeForPrompt(eventDateTime, 200),
          eventSpeakers: sanitizeForPrompt(eventSpeakers, 1000),
          invitationReason: sanitizeForPrompt(invitationReason, 2000),
          simpleRequirement: sanitizeForPrompt(simpleRequirement, 1000),
        };

        // モデル選択 (proの場合は2.0-flash-exp, flashの場合も現状は2.0-flash-expを優先)
        // ユーザーが明示的にproを選んだ場合でも、安定性のために同じフォールバック戦略を使うか、
        // あるいはproならより高性能なモデルをprimaryにするなどの調整が可能。
        // ここでは既存ロジックに従い、primaryを設定。
        const primaryModelName = model === 'pro' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';

        let prompt = '';

        // かんたんモードの場合（セールスモードのみ）
        if (mode === 'sales' && inputComplexity === 'simple') {
          prompt = `あなたはCxO向けセールスレターの専門家です。
以下の最小限の情報から、経営層に「会いたい」と思わせる営業手紙を作成してください。

【提供された情報】
ターゲット企業名: ${safe.companyName}
自社サービス概要: ${safe.myServiceDescription}
${safe.simpleRequirement ? `伝えたい要件: ${safe.simpleRequirement}` : ''}

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
        }
        // イベント招待モード（まとめて入力）の場合
        else if (mode === 'event' && inputComplexity === 'simple') {
          prompt = `あなたはイベント招待状の専門家です。
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
        }
        // イベント招待モード（ステップ入力）の場合
        else if (mode === 'event') {
          prompt = `あなたはイベント招待状の専門家です。
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
        }
        // まとめて入力モードの場合（セールスモード）
        else if (freeformInput) {
          prompt = `あなたはCxO向けセールスレターの専門家です。
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
        }
        // ステップ入力モードの場合（従来のロジック）
        else {
          prompt = `あなたはCxO向けセールスレターの専門家です。
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
        }

        // フォールバック付きで生成を実行
        const result = await generateWithFallback(prompt, primaryModelName);
        const letter = result.text;

        return NextResponse.json({ letter });

      } catch (error: any) {
        devLog.error('生成エラー:', error);

        // エラーの種類に応じてメッセージを使い分ける
        let errorMessage = '手紙の生成に失敗しました';
        let errorCode = 'UNKNOWN_ERROR';
        let status = 500;

        if (error.message?.includes('429') || error.status === 429) {
          errorMessage = 'AIモデルの利用制限に達しました。しばらく待ってから再試行してください。';
          errorCode = 'RATE_LIMIT_EXCEEDED';
          status = 429;
        } else if (error.message?.includes('API key') || error.status === 401) {
          errorMessage = 'APIキーが無効か、設定されていません。';
          errorCode = 'AUTH_ERROR';
          status = 401;
        } else if (error.message?.includes('safety') || error.message?.includes('blocked')) {
          errorMessage = '生成された内容が安全基準に抵触したため、表示できません。入力内容を見直してください。';
          errorCode = 'SAFETY_ERROR';
          status = 400;
        } else if (error.message?.includes('overloaded')) {
          errorMessage = 'AIモデルが混雑しています。しばらく待ってから再試行してください。';
          errorCode = 'MODEL_OVERLOADED';
          status = 503;
        }

        return NextResponse.json(
          {
            error: errorMessage,
            code: errorCode,
            details: error.message
          },
          { status }
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
