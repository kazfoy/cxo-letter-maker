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
    console.error('[CRITICAL ERROR] APIキーが設定されていません！.envファイルを確認してください。');
    console.error('Available Env Vars:', Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET'))); // 安全な環境変数名のみ出力
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
  searchResults: z.string().max(5000, '検索結果は5000文字以内で入力してください').optional(),
  output_format: z.enum(['letter', 'email']).default('letter'),
});

// ヘルパー関数: フォールバック付きで生成を実行
async function generateWithFallback(prompt: string, primaryModelName: string = 'gemini-2.0-flash-exp') {
  const google = getGoogleProvider();
  const primaryModel = google(primaryModelName);
  // フォールバックは安定版の 1.5-flash
  const fallbackModel = google('gemini-1.5-flash');

  try {
    const result = await generateText({
      model: primaryModel,
      prompt: prompt,
    });
    return result;
  } catch (error: any) {
    console.error(`[ERROR] プライマリモデル ${primaryModelName} 失敗:`, {
      message: error.message,
      stack: error.stack,
      status: error.status,
      cause: error.cause,
      fullError: JSON.stringify(error, null, 2),
    });
    devLog.warn(`Primary model ${primaryModelName} failed, trying fallback to gemini-1.5-flash...`, error);
    try {
      const result = await generateText({
        model: fallbackModel,
        prompt: prompt,
      });
      return result;
    } catch (fallbackError: any) {
      // 両方失敗した場合は、元のエラー（または最後のあがきでfallbackError）を投げる
      // ここでは詳細なエラー情報を呼び出し元に伝えるためにfallbackErrorを投げる
      console.error('[ERROR] フォールバックモデルも失敗:', {
        message: fallbackError.message,
        stack: fallbackError.stack,
        status: fallbackError.status,
        cause: fallbackError.cause,
        fullError: JSON.stringify(fallbackError, null, 2),
      });
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
      let guestId = '';
      let isNewGuest = false;

      if (!user) {
        const cookieStore = await cookies();
        guestId = cookieStore.get('guest_id')?.value || '';

        if (!guestId) {
          // Cookieがない場合は新規発行
          guestId = crypto.randomUUID();
          isNewGuest = true;
          devLog.log('Generated new guest_id in API:', guestId);
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
          output_format = 'letter',
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
          searchResults: sanitizeForPrompt(data.searchResults || '', 5000),
          output_format: output_format, // No sanitization needed for enum/fixed string, but good to have in safe obj if used? Actually strict check is better.
        };

        // モデル選択 (proの場合は2.0-flash-exp, flashの場合も現状は2.0-flash-expを優先)
        // ユーザーが明示的にproを選んだ場合でも、安定性のために同じフォールバック戦略を使うか、
        // あるいはproならより高性能なモデルをprimaryにするなどの調整が可能。
        // ここでは既存ロジックに従い、primaryを設定。
        const primaryModelName = model === 'pro' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';

        let prompt = '';


        // JSONレスポンスを強制する指示を追加
        const jsonInstruction = `
【出力形式（厳守）】
以下のJSONフォーマットで出力してください。Markdownのコードブロック（\`\`\`json）は不要です。純粋なJSON文字列のみを出力してください。
{
  "standard": "王道パターンの手紙本文（プレーンテキスト）",
  "emotional": "熱意重視パターンの手紙本文（プレーンテキスト）",
  "consultative": "課題解決重視パターンの手紙本文（プレーンテキスト）"
}
`;


        // ==========================================
        // プロンプト構築
        // ==========================================


        // 1. メール生成モード
        if (output_format === 'email') {
          // ==========================================
          // メール生成モード
          // ==========================================
          const emailJsonInstruction = `
【出力形式（厳守）】
以下のJSONフォーマットで出力してください。Markdownのコードブロック（\`\`\`json）は不要です。純粋なJSON文字列のみを出力してください。
{
  "subject": "件名テキスト",
  "body": "本文テキスト"
}
`;
          prompt = `
あなたはプロフェッショナルなCxO向けのメールライターです。
以下の情報を元に、ビジネスメールを作成してください。

【送信先（ターゲット）】
* 企業名: ${safe.companyName}
* 役職: ${safe.position}
* 氏名: ${safe.name}

【差出人（あなた）】
* 企業名: ${safe.myCompanyName}
* 氏名: ${safe.myName}
* 自社サービス: ${safe.myServiceDescription}

【文面構成要素】
1. 背景・コンテキスト: ${safe.background}
2. 課題仮説: ${safe.problem}
3. 解決策（ソリューション）: ${safe.solution}
4. 事例・実績: ${safe.caseStudy}
5. オファー: ${safe.offer}

${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【作成ルール】
* **件名 (Subject)**:
  * 開封したくなる具体的かつ魅力的な件名にすること（30文字以内推奨）。
  * 具体的メリットや緊急性、あるいは親近感を持たせる工夫をする。
* **本文 (Body)**:
  * メール特有の簡潔さを重視する。
  * 冒頭で「突然のご連絡失礼いたします」等の定型句は最小限にし、本題への導入をスムーズにする。
  * スマートフォンでも読みやすい改行・段落構成にする。
* **JSON出力（厳守）**:
  * 指定されたJSON形式のみを出力すること。

${emailJsonInstruction}
`;
        }
        // 2. かんたんモード（セールス）
        else if (mode === 'sales' && inputComplexity === 'simple') {
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
以下の最小限の情報から、経営層に「会いたい」と思わせる、プロフェッショナルで熱意のある営業手紙を作成してください。
今回は、アプローチの異なる3つのパターン（王道、熱意、課題解決）を提案してください。

【提供された情報】
ターゲット企業名: ${safe.companyName}
自社サービス概要: ${safe.myServiceDescription}
${safe.simpleRequirement ? `伝えたい要件: ${safe.simpleRequirement}` : ''}
${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【3つのパターン定義】
1. **Pattern A: Standard (王道)**
   - 礼儀正しく、バランスの取れた構成。信頼感を最優先する。
2. **Pattern B: Emotional (熱意重視)**
   - 「なぜ貴社なのか（Why You）」を熱く語る。感情に訴えかけ、書き手の想いを前面に出す。
3. **Pattern C: Consultative (課題解決重視)**
   - 相手の課題を鋭く指摘し、論理的な解決策（ソリューション）を提示する。コンサルタントのような立ち位置。

【執筆ルール（共通・厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。
* **出力形式**: 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }
        // 3. イベント招待モード（まとめて入力）
        else if (mode === 'event' && inputComplexity === 'simple') {
          prompt = `あなたはイベント招待状の専門家です。
以下の最小限の情報から、魅力的で具体的なイベント招待状を作成してください。
今回は、アプローチの異なる3つのパターン（王道、熱意、課題解決）を提案してください。

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

【3つのパターン定義】
1. **Pattern A: Standard (王道)**
   - 丁寧で公式なトーン。情報の正確さと礼儀を重視。
2. **Pattern B: Emotional (熱意重視)**
   - 「あなたに来てほしい」という強い想いを伝える。イベントの熱量を表現する。
3. **Pattern C: Consultative (課題解決重視)**
   - イベント参加が相手のビジネス課題をどう解決するか、メリットを論理的に訴求する。

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること
- 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }
        // 4. イベント招待モード（ステップ入力）
        else if (mode === 'event') {
          prompt = `あなたはイベント招待状の専門家です。
以下の情報を基に、丁寧でありながらも相手の時間を尊重した、魅力的なイベント招待状を作成してください。
今回は、アプローチの異なる3つのパターン（王道、熱意、課題解決）を提案してください。

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

【3つのパターン定義】
1. **Pattern A: Standard (王道)**
   - 丁寧で公式なトーン。情報の正確さと礼儀を重視。
2. **Pattern B: Emotional (熱意重視)**
   - 「あなたに来てほしい」という強い想いを伝える。イベントの熱量を表現する。
3. **Pattern C: Consultative (課題解決重視)**
   - イベント参加が相手のビジネス課題をどう解決するか、メリットを論理的に訴求する。

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること
- 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }
        // 5. まとめて入力モード（セールス）
        else if (freeformInput) {
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
提供されたテキストから、CxOレターの5つの要素（背景・課題・解決策・実績・オファー）を抽出し、プロフェッショナルで熱意のある営業手紙を作成してください。
今回は、アプローチの異なる3つのパターン（王道、熱意、課題解決）を提案してください。

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

【3つのパターン定義】
1. **Pattern A: Standard (王道)**
   - 礼儀正しく、バランスの取れた構成。信頼感を最優先する。
2. **Pattern B: Emotional (熱意重視)**
   - 「なぜ貴社なのか（Why You）」を熱く語る。感情に訴えかけ、書き手の想いを前面に出す。
3. **Pattern C: Consultative (課題解決重視)**
   - 相手の課題を鋭く指摘し、論理的な解決策（ソリューション）を提示する。コンサルタントのような立ち位置。

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。
* **出力形式**: 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }
        // 6. ステップ入力モード（セールス・従来）
        else {
          prompt = `あなたは大手企業の決裁者向けに、数々のアポイントを獲得してきた伝説のインサイドセールス兼コピーライターです。
以下の情報を基に、経営層に「会いたい」と思わせる、プロフェッショナルで熱意のある営業手紙を作成してください。
今回は、アプローチの異なる3つのパターン（王道、熱意、課題解決）を提案してください。

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

${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【3つのパターン定義】
1. **Pattern A: Standard (王道)**
   - 礼儀正しく、バランスの取れた構成。信頼感を最優先する。
2. **Pattern B: Emotional (熱意重視)**
   - 「なぜ貴社なのか（Why You）」を熱く語る。感情に訴えかけ、書き手の想いを前面に出す。
3. **Pattern C: Consultative (課題解決重視)**
   - 相手の課題を鋭く指摘し、論理的な解決策（ソリューション）を提示する。コンサルタントのような立ち位置。

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 抽象的な「DXの推進」といった言葉だけで終わらせること（具体的なメリットを提示する）。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。
* **出力形式**: 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }


        // フォールバック付きで生成を実行
        const result = await generateWithFallback(prompt, primaryModelName);
        const generatedText = result.text.trim();

        // JSONパース処理
        let responseData: any = {};
        let parseSuccess = false;

        try {
          // 1. Markdownコードブロックを除去 regex to capture content between ```json and ```
          // シンプルな除去: ```json ... ```, ``` ... ```, または単に { ... } を抽出
          let cleanedText = generatedText;

          // Markdown記法 (```json ... ```) がある場合、その中身を取り出す
          const jsonMatch = generatedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanedText = jsonMatch[1].trim();
          } else {
            // 見つからない場合、全体から { ... } の範囲を探す試み (簡易的)
            const firstBrace = generatedText.indexOf('{');
            const lastBrace = generatedText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              cleanedText = generatedText.substring(firstBrace, lastBrace + 1);
            }
          }

          const parsed = JSON.parse(cleanedText);
          parseSuccess = true;

          if (output_format === 'email') {
            // Emailモードの場合は { subject, body } を期待
            if (parsed.subject && parsed.body) {
              responseData = {
                email: parsed
              };
            } else {
              // パースできたが構造が違う場合、Bodyのみとして扱うなどのフォールバック
              responseData = {
                email: {
                  subject: '件名なし',
                  body: typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
                }
              };
            }
          } else {
            // Letterモードの場合は { standard, emotional, consultative } を期待
            responseData = {
              variations: parsed,
              // 後方互換性: デフォルトはstandard、なければ最初の値
              letter: parsed.standard || Object.values(parsed)[0] || '生成された手紙'
            };
          }

        } catch (e) {
          console.warn('JSON Parse failed, using fallback.', e);
          // パース失敗時のフォールバック
          if (output_format === 'email') {
            responseData = {
              email: {
                subject: '件名なし (自動生成)',
                body: generatedText
              }
            };
          } else {
            // 通常モード: 生テキストをそのまま返す（あるいはstandardとして扱う）
            // 以前の挙動に合わせて letter に入れる
            responseData = {
              letter: generatedText,
              variations: {
                standard: generatedText, // 仮
                emotional: generatedText,
                consultative: generatedText
              }
            };
          }
        }

        const response = NextResponse.json(responseData);

        // 新規ゲストの場合はCookieを発行
        if (isNewGuest && guestId) {
          response.cookies.set('guest_id', guestId, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1年間有効
            httpOnly: true,
            sameSite: 'lax',
          });
        }

        return response;

      } catch (error: any) {
        // 詳細なエラーログ出力（デバッグ用）
        console.error('[ERROR] 生成エラー詳細:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          status: error.status,
          statusCode: error.statusCode,
          code: error.code,
          cause: error.cause,
        });
        // オブジェクトとして直接出力（JSON.stringifyでは消える情報があるため）
        console.error('[ERROR] Full Error Object:', error);

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

        const errorResponse = NextResponse.json(
          {
            error: errorMessage,
            code: errorCode,
            details: error.message
          },
          { status }
        );

        if (isNewGuest && guestId) {
          errorResponse.cookies.set('guest_id', guestId, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1年間有効
            httpOnly: true,
            sameSite: 'lax',
          });
        }

        return errorResponse;
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
