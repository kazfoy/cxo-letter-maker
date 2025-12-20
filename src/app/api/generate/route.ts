import { cookies } from 'next/headers';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt, detectInjectionAttempt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';

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
      // ゲストユーザーのレート制限チェック (DBベース)
      if (!user) {
        const cookieStore = await cookies();
        const guestId = cookieStore.get('guest_id')?.value;

        if (!guestId) {
          return NextResponse.json(
            {
              error: 'ゲストIDが見つかりません。Cookieを有効にしてください。',
              code: 'GUEST_ID_MISSING',
              message: 'ブラウザのCookieが無効になっている可能性があります。'
            },
            { status: 400 }
          );
        }

        const { allowed, usage } = await checkAndIncrementGuestUsage(guestId);

        if (!allowed) {
          return NextResponse.json(
            {
              error: 'ゲスト利用の上限（1日3回）に達しました。',
              code: 'GUEST_LIMIT_REACHED',
              message: '無料枠の上限に達しました。ログインすると無制限で利用できます。',
              usage // フロントエンドで表示するために現在の利用状況を返す
            },
            { status: 429 }
          );
        }
      }

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
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
以下の最小限の情報から、経営層に「会いたい」と思わせる、プロフェッショナルで熱意のある営業手紙を作成してください。

【提供された情報】
ターゲット企業名: ${safe.companyName}
自社サービス概要: ${safe.myServiceDescription}
${safe.simpleRequirement ? `伝えたい要件: ${safe.simpleRequirement}` : ''}

【あなたの役割】
提供された情報が少ないため、以下の要素をAIが推測・補完して、完全なCxOレターを作成してください。

【補完すべき要素】
1. 個別化された導入: ${safe.companyName}の業界ニュースやIR情報（と仮定できる内容）に触れ、「貴社を深く調べている」ことを示す。
2. 課題の共感: 業界特有の課題（Why Now）を指摘し、共感を示す。
3. 解決策の提示: ${safe.myServiceDescription}がその課題をどう解決できるか（Why You）を提示。
4. 社会的証明: 同業他社の事例（具体的な企業名は出さずとも、成果を数字で示す）。
5. 明確なCTA: 「情報交換」や「ディスカッション」を目的としたオファー。

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。

* **推奨事項 (OK)**:
    * **書き出し**: 相手企業のニュースや動向に触れ、1行目で「自分ごと」と思わせる。
    * **本文**: 「なぜ今、あなたに連絡したのか（Why You, Why Now）」を論理的かつ熱意を持って伝える。
    * **オファー**: 「30分だけ時間をください」ではなく、「この課題解決のヒントとなる情報交換をさせてください」とメリットを提示する。

【構成】
1. **個別化された導入**: 相手へのリスペクトと調査結果。
2. **課題の共感**: 業界課題への深い理解。
3. **解決策の提示**: 自社ソリューションの独自性（売り込みすぎない）。
4. **社会的証明**: 同業他社の事例。
5. **明確なCTA**: 次のアクション（日程調整など）。

【フォーマット制約】
- 文字数: 800〜1000文字程度
- 宛名は「${safe.companyName} ご担当者様」で始める
- 末尾は「${safe.myServiceDescription}を提供している者より」で締める
- URLはリンク記法を使わず、そのまま記述すること
- プレーンテキストのみで出力すること

それでは、手紙本文を作成してください。`;
        }
        // イベント招待モード（まとめて入力）の場合
        else if (mode === 'event' && inputComplexity === 'simple') {
          prompt = `あなたはイベント招待状の専門家です。
以下の最小限の情報から、魅力的で具体的なイベント招待状を作成してください。

【提供された情報】
イベントURL: ${safe.eventUrl || '情報なし'}
${safe.eventName ? `イベント名: ${safe.eventName}` : ''}
${safe.eventDateTime ? `開催日時・場所: ${safe.eventDateTime}` : ''}
${safe.eventSpeakers ? `主要登壇者/ゲスト: ${safe.eventSpeakers}` : ''}
ターゲット企業名: ${safe.companyName}
${safe.invitationReason ? `誘いたい理由・メモ: ${safe.invitationReason}` : ''}

【差出人（自社）情報】
会社名: ${safe.myCompanyName || '（記載なし）'}
氏名: ${safe.myName || '（記載なし）'}

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
- 宛名は「${safe.companyName} ご担当者様」で始める
- 末尾は「${safe.myCompanyName || '主催者'}${safe.myName ? '\n' + safe.myName : ''}」で締める

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
会社名: ${safe.myCompanyName}
氏名: ${safe.myName}
自社について: ${safe.myServiceDescription}

【招待先情報】
企業名: ${safe.companyName}
役職: ${safe.position || ''}
氏名: ${safe.name}

【イベント情報】
イベント名: ${safe.eventName}
開催日時・場所: ${safe.eventDateTime}
主要登壇者/ゲスト: ${safe.eventSpeakers || 'なし'}
イベントURL: ${safe.eventUrl || 'なし'}

【招待の背景（Why You?）】
${safe.invitationReason}

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
- 宛名は「${safe.companyName} ${safe.position ? safe.position + ' ' : ''}${safe.name}様」で始める
- 末尾は「${safe.myCompanyName}\n${safe.myName}」で締める

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
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
提供されたテキストから、CxOレターの5つの要素（背景・課題・解決策・実績・オファー）を抽出し、プロフェッショナルで熱意のある営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${safe.myCompanyName}
氏名: ${safe.myName}
サービス概要: ${safe.myServiceDescription}

【ターゲット情報】
企業名: ${safe.companyName}
役職: ${safe.position || '経営者'}
氏名: ${safe.name}

【提供されたテキスト】
${safe.freeformInput}

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。

* **推奨事項 (OK)**:
    * **書き出し**: 相手企業のニュースや動向に触れ、1行目で「自分ごと」と思わせる。
    * **本文**: 「なぜ今、あなたに連絡したのか（Why You, Why Now）」を論理的かつ熱意を持って伝える。
    * **オファー**: 「30分だけ時間をください」ではなく、「この課題解決のヒントとなる情報交換をさせてください」とメリットを提示する。

【構成】
1. **個別化された導入**: 相手へのリスペクトと調査結果。
2. **課題の共感**: 業界課題への深い理解。
3. **解決策の提示**: 自社ソリューションの独自性（売り込みすぎない）。
4. **社会的証明**: 同業他社の事例。
5. **明確なCTA**: 次のアクション（日程調整など）。

【フォーマット制約】
- 文字数: 800〜1200文字程度
- 宛名は「${safe.companyName} ${safe.position ? safe.position + ' ' : ''}${safe.name}様」で始める
- 末尾は「${safe.myCompanyName}\n${safe.myName}」で締める
- URLはリンク記法を使わず、そのまま記述すること
- プレーンテキストのみで出力すること

それでは、手紙本文を作成してください。`;
        }
        // ステップ入力モードの場合（従来のロジック）
        else {
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
以下の情報を基に、経営層に「会いたい」と思わせる、プロフェッショナルで熱意のある営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${safe.myCompanyName}
氏名: ${safe.myName}
サービス概要: ${safe.myServiceDescription}

【ターゲット情報】
企業名: ${safe.companyName}
役職: ${safe.position || '経営者'}
氏名: ${safe.name}

【手紙の構成要素（5つの要素）】
1. 背景・フック: ${safe.background}
2. 課題の指摘: ${safe.problem}
3. 解決策の提示: ${safe.solution}
4. 事例・実績: ${safe.caseStudy}
5. オファー: ${safe.offer}

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。

* **推奨事項 (OK)**:
    * **書き出し**: 相手企業のニュースや動向に触れ、1行目で「自分ごと」と思わせる。
    * **本文**: 「なぜ今、あなたに連絡したのか（Why You, Why Now）」を論理的かつ熱意を持って伝える。
    * **オファー**: 「30分だけ時間をください」ではなく、「この課題解決のヒントとなる情報交換をさせてください」とメリットを提示する。

【構成】
1. **個別化された導入**: 相手へのリスペクトと調査結果。
2. **課題の共感**: 業界課題への深い理解。
3. **解決策の提示**: 自社ソリューションの独自性（売り込みすぎない）。
4. **社会的証明**: 同業他社の事例。
5. **明確なCTA**: 次のアクション（日程調整など）。

【フォーマット制約】
- 文字数: 800〜1200文字程度
- 宛名は「${safe.companyName} ${safe.position ? safe.position + ' ' : ''}${safe.name}様」で始める
- 末尾は「${safe.myCompanyName}\n${safe.myName}」で締める
- URLはリンク記法を使わず、そのまま記述すること
- プレーンテキストのみで出力すること

それでは、手紙本文を作成してください。`;
        }

        // フォールバック付きで生成を実行
        const result = await generateWithFallback(prompt, primaryModelName);
        const letter = result.text;

        const response = NextResponse.json({ letter });



        return response;

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
      requireAuth: false, // ゲスト利用を許可
      rateLimit: {
        windowMs: 60000,
        maxRequests: 20,
      },
    }
  );
}
