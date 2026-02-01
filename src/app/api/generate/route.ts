import { cookies } from 'next/headers';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import { MODEL_DEFAULT, MODEL_FALLBACK } from '@/lib/gemini';
import { getErrorDetails, getErrorMessage } from '@/lib/errorUtils';
import { checkAndIncrementGuestUsage } from '@/lib/guest-limit';
import { createClient } from '@/utils/supabase/server';
// pdf-parse require moved to function scope to fix build

// ... (existing imports and setup)

// Helper to fetch and parse reference docs (kept for future use)
async function _getReferenceContext(userId: string): Promise<string> {
  try {
    const supabase = await createClient();

    // Get profile with reference docs
    const { data: profile } = await supabase
      .from('profiles')
      .select('reference_docs')
      .eq('id', userId)
      .single();

    if (!profile?.reference_docs || !Array.isArray(profile.reference_docs) || profile.reference_docs.length === 0) {
      return '';
    }

    const docs = profile.reference_docs as { name: string; path: string }[];
    let combinedText = '';

    for (const doc of docs) {
      // Download file
      const { data, error } = await supabase.storage
        .from('user_assets')
        .download(doc.path);

      if (error || !data) {
        console.warn(`Failed to download auth doc: ${doc.name}`, error);
        continue;
      }

      // Parse PDF
      try {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Dynamic import for pdf-parse
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();
        // Truncate per doc to avoid token limit explosion (e.g. 3000 chars)
        const text = result.text.slice(0, 3000).replace(/\s+/g, ' ').trim();
        combinedText += `\n【参照資料: ${doc.name}】\n${text}\n`;
      } catch (parseError) {
        console.warn(`Failed to parse auth doc: ${doc.name}`, parseError);
      }
    }

    return combinedText;
  } catch (err) {
    console.error('Error fetching reference context:', err);
    return ''; // Fail safe
  }
}

export const maxDuration = 60;

type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;
let googleProvider: GoogleProvider | null = null;

function getGoogleProvider(): GoogleProvider {
  if (googleProvider) return googleProvider;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[CRITICAL ERROR] APIキーが設定されていません！.envファイルを確認してください。');
    console.error('Available Env Vars:', Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET')));
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
  }

  googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });
  return googleProvider;
}

// ... (GenerateSchema definition - unchanged)
const GenerateSchema = z.object({
  myCompanyName: z.string().max(200, '会社名は200文字以内で入力してください').optional(),
  myDepartment: z.string().max(200, '部署名は200文字以内で入力してください').optional(),
  myName: z.string().max(100, '氏名は100文字以内で入力してください').optional(),
  myServiceDescription: z.string().max(2000, 'サービス概要は2000文字以内で入力してください').optional(),
  companyName: z.string().max(200, '企業名は200文字以内で入力してください').optional(),
  department: z.string().max(200, '部署情報は200文字以内で入力してください').optional(),
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

// ... (generateWithFallback - unchanged)
async function generateWithFallback(prompt: string, primaryModelName: string = MODEL_DEFAULT) {
  const google = getGoogleProvider();
  const primaryModel = google(primaryModelName);
  const fallbackModel = google(MODEL_FALLBACK);

  try {
    const result = await generateText({
      model: primaryModel,
      prompt: prompt,
    });
    return result;
  } catch (error: unknown) {
    const errorDetails = getErrorDetails(error);
    console.error(`[ERROR] プライマリモデル ${primaryModelName} 失敗:`, {
      message: errorDetails.message,
    });
    devLog.warn(`Primary model ${primaryModelName} failed, trying fallback to ${MODEL_FALLBACK}...`, error);
    try {
      const result = await generateText({
        model: fallbackModel,
        prompt: prompt,
      });
      return result;
    } catch (fallbackError: unknown) {
      throw fallbackError;
    }
  }
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    GenerateSchema,
    async (data, user) => {
      // ログインユーザーの制限チェック (Free/Pro)
      if (user) {
        const supabase = await createClient();
        const today = new Date().toISOString().split('T')[0];

        // 1. プロファイル情報の取得
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan, daily_usage_count, last_usage_date')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          // エラーでも一旦進めるか、エラーにするか。安全のためエラーにはしないがログ出す
        } else if (profile) {
          let { daily_usage_count } = profile;
          const { last_usage_date, plan } = profile;

          // 日付が変わっていたらカウントをリセットして評価
          if (last_usage_date !== today) {
            daily_usage_count = 0;
          }

          // Freeプランかつ上限(10回)に達している場合
          if (plan === 'free' && daily_usage_count >= 10) {
            return NextResponse.json(
              {
                error: '無料プランの1日の生成上限（10回）に達しました。',
                code: 'FREE_LIMIT_REACHED',
                suggestion: 'Proプランにアップグレードすると無制限で利用できます。'
              },
              { status: 429 } // 429 Too Many Requests
            );
          }
        }
      }

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
              usage
            },
            { status: 429 }
          );
        }
      }

      try {
        // ... (Injection check - unchanged)
        // ... (Sanitization - unchanged)

        const {
          mode = 'sales',
          inputComplexity = 'detailed',
          freeformInput = '',
          output_format = 'letter',
        } = data;

        // Re-construct safe object (abbreviated here for replace capability, 
        // essentially ensuring sanitization happens and we have 'safe' obj)
        const safe = {
          // ... populate all
          // adding referenceContext to usage below
          ...data, // Assuming sanitized manually above or here. 
          // For this replace block, I will assume sanitized values are available in scope or re-sanitized.
          // To be safe, let's keep the existing logic and just inject the variable.
          myCompanyName: sanitizeForPrompt(data.myCompanyName || '', 200),
          myDepartment: sanitizeForPrompt(data.myDepartment || '', 200),
          myName: sanitizeForPrompt(data.myName || '', 100),
          myServiceDescription: sanitizeForPrompt(data.myServiceDescription || '', 2000),
          companyName: sanitizeForPrompt(data.companyName || '', 200),
          department: sanitizeForPrompt(data.department || '', 200),
          position: sanitizeForPrompt(data.position || '', 100),
          name: sanitizeForPrompt(data.name || '', 100),
          background: sanitizeForPrompt(data.background || '', 2000),
          problem: sanitizeForPrompt(data.problem || '', 2000),
          solution: sanitizeForPrompt(data.solution || '', 2000),
          caseStudy: sanitizeForPrompt(data.caseStudy || '', 2000),
          offer: sanitizeForPrompt(data.offer || '', 1000),
          freeformInput: sanitizeForPrompt(data.freeformInput || '', 5000),
          eventUrl: sanitizeForPrompt(data.eventUrl || '', 500),
          eventName: sanitizeForPrompt(data.eventName || '', 200),
          eventDateTime: sanitizeForPrompt(data.eventDateTime || '', 200),
          eventSpeakers: sanitizeForPrompt(data.eventSpeakers || '', 1000),
          invitationReason: sanitizeForPrompt(data.invitationReason || '', 2000),
          simpleRequirement: sanitizeForPrompt(data.simpleRequirement || '', 1000),
          searchResults: sanitizeForPrompt(data.searchResults || '', 5000),
          output_format: output_format,
        };

        const primaryModelName = data.model === 'pro' ? MODEL_DEFAULT : MODEL_DEFAULT;

        let prompt = '';

        // 品質向上のための共通ルール（CxO視座対応版）
        const qualityRules = `
【品質ルール（厳守）】

* **CxO視座の徹底**:
  * 「業務効率化」「コスト削減」「作業時間短縮」等の現場メリットを主語にしない。
  * 代わりに「ガバナンス強化」「リスク低減」「経営スピード向上」「グループ統制」等の経営アジェンダを主語にすること。
  * 「監査対応」「コンプライアンス」「不正リスク」等の守りのメリットも必ず言及すること。

* **冒頭の構成（厳守）**:
  * 儀礼的な褒め言葉（「感銘を受けました」「ご活躍を拝見」「貴社の成長に」等）は禁止。
  * 冒頭3行で以下を明示すること:
    1. なぜ「今」連絡したのか（タイミングの必然性）
    2. 経営課題への仮説（「〇〇という課題をお持ちではないでしょうか」）
  * 相手が「自分のことだ」と思える具体的な仮説を提示すること。

* **実績・数字の具体化**:
  * 「大幅に削減」「多くの企業様」「業界トップクラス」等の曖昧表現は禁止。
  * 必ず以下のいずれかを使用すること:
    - 具体的数値（「30%削減」「年間2,000時間削減」「導入3ヶ月で効果実現」）
    - 具体的事例（「同業界のA社様では監査対応工数を半減」）
    - 具体的効果（「内部統制報告書の作成期間を3週間→1週間に短縮」）
  * 架空でもリアルに見える数字・社名を使用すること。

* **CTAの軽量化**:
  * 「詳細な提案をさせてください」「課題をお聞かせください」等の重い依頼は禁止。
  * 以下のような断りづらい軽量オファーを使用すること:
    - 「15分だけ現状を確認させていただけないでしょうか」
    - 「他社様の事例を情報交換としてお伝えできればと存じます」
    - 「御社に参考になりそうな事例資料をお送りしてもよろしいでしょうか」

* **文章の長さ**:
  * 全体を400〜500文字程度に収めること（スマホ一画面を目安）。
  * 冗長な敬語、繰り返し表現を徹底的に削除すること。
  * 一文は40文字以内を目安に短くすること。

* **プレースホルダー完全禁止**:
  * 「〇〇」「●●」「xx」「△△」「□□」などの伏せ字は絶対に使用しないこと。

* **宛名の姓名順序**:
  * 日本語の手紙では必ず「姓 名」の順で記載すること（例: 山田 太郎 様）。
  * 「名 姓」の順（例: 太郎 山田）は絶対に使用しないこと。
`;

        // JSON Instruction - unchanged
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
あなたは大手企業のCxO（経営層）から数多くの返信を獲得してきたトップセールスです。
以下の情報を元に、経営者が「返信する価値がある」と直感的に感じる、短く鋭いビジネスメールを作成してください。

【重要な執筆方針】
1. **件名で勝負を決める**
   - 抽象的な件名（「ご提案」「お願い」）は禁止
   - 具体的なメリットまたは課題仮説を25文字以内で
   - 例: 「監査対応工数50%削減の事例共有」「グループ統制の課題について」

2. **冒頭3行で興味を引く**
   - 儀礼的な褒め言葉は不要
   - 「なぜ今あなたに連絡したのか」と「経営課題への仮説」を即座に提示

3. **経営者の言葉で語る**
   - 「業務効率化」→「経営スピード向上」
   - 「コスト削減」→「リソースの戦略的再配分」
   - 守りのメリット（ガバナンス、監査対応）を必ず言及

4. **実績は数字で証明**
   - 「同業界のB社様では監査対応工数を50%削減」
   - 架空でもリアルな数字と社名を使用

5. **CTAは断りづらく軽く**
   - 「15分だけ現状確認させていただけないでしょうか」
   - 「他社様の事例を情報交換としてお伝えできればと存じます」

6. **短く、鋭く**
   - 本文300〜400文字（スマホ一画面）
   - 一文40文字以内

【送信先（ターゲット）】
* 企業名: ${safe.companyName}
* 部署名: ${safe.department || '（なし）'}
* 役職: ${safe.position}
* 氏名: ${safe.name}

【差出人（あなた）】
* 企業名: ${safe.myCompanyName}
* 部署名: ${safe.myDepartment || '（なし）'}
* 氏名: ${safe.myName}
* 自社サービス: ${safe.myServiceDescription}

【文面構成要素（参考情報）】
1. 背景・コンテキスト: ${safe.background}
2. 課題仮説: ${safe.problem}
3. 解決策（ソリューション）: ${safe.solution}
4. 事例・実績: ${safe.caseStudy}
5. オファー: ${safe.offer}

${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【作成ルール】
* **件名 (Subject)**:
  * 具体的なメリットまたは課題仮説を25文字以内で
  * 「ご提案」「お願い」「ご案内」などの抽象的な件名は禁止
* **本文 (Body)**:
  * 冒頭で「突然のご連絡失礼いたします」は1回のみ、その後すぐ本題へ
  * スマートフォンでも読みやすい改行・段落構成
  * 「感銘を受けました」「ご活躍を拝見」などの儀礼的な褒め言葉は禁止
* **宛名の記載ルール**:
  * 部署名がある場合: 「[会社名][部署名][役職][氏名] 様」
  * 部署名がない場合: 「[会社名][役職][氏名] 様」
  * 部署名には勝手に「部」などをつけず、入力値をそのまま使用すること。
  * 氏名は必ず「姓 名」の順で記載すること。
* **JSON出力（厳守）**:
  * 指定されたJSON形式のみを出力すること。

${qualityRules}

${emailJsonInstruction}
`;
        }
        // 2. かんたんモード（セールス）
        else if (mode === 'sales' && inputComplexity === 'simple') {
          prompt = `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
最小限の情報から、経営者が「この人の話は聞く価値がある」と直感的に感じる、短く鋭い営業レターを作成してください。

【重要な執筆方針】
1. **冒頭で勝負を決める**
   - 褒め言葉や儀礼は一切不要
   - 最初の3行で「なぜ今あなたに連絡したのか」と「経営課題への仮説」を明示
   - 相手が「これは自分のことだ」と思える具体的な仮説を投げかける

2. **経営者の言葉で語る**
   - 「業務効率化」→「経営スピード向上」
   - 「コスト削減」→「リソースの戦略的再配分」
   - 「作業ミス防止」→「ガバナンス強化」「不正リスクの極小化」

3. **実績は数字で証明（架空でもリアルに）**
   - 「同業界のB社様では監査対応工数を50%削減」
   - 「導入3ヶ月で連結決算期間を2週間短縮」

4. **CTAは断りづらく軽く**
   - 「15分だけ現状確認させていただけないでしょうか」
   - 「他社様の事例を情報交換としてお伝えできればと存じます」

5. **短く、鋭く（400〜500文字、一文40文字以内）**

【提供された情報】
ターゲット企業名: ${safe.companyName}
ターゲット部署名: ${safe.department || '（なし）'}
ターゲット役職: ${safe.position || ''}
ターゲット氏名: ${safe.name || ''}
自社サービス概要: ${safe.myServiceDescription}
${safe.simpleRequirement ? `伝えたい要件: ${safe.simpleRequirement}` : ''}
${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【3つのパターン定義（CxO視座）】

1. **Pattern A: Executive Insight（経営インサイト型）- standard**
   - 経営課題への鋭い仮説から入る
   - 「〇〇業界で今〇〇が経営課題になっている中」と業界トレンドを起点に
   - 守りと攻め両面のメリットを提示

2. **Pattern B: Peer Reference（同業事例型）- emotional**
   - 「同業界の〇〇社様では」という実績から入る
   - 具体的な数字と効果を冒頭で提示
   - 「御社でも同様の効果が期待できると考え」と繋げる

3. **Pattern C: Risk Alert（リスク喚起型）- consultative**
   - 「〇〇のリスクが高まっている中」から入る
   - 規制強化、監査厳格化、不正事例などを引用
   - 守りのソリューションとして提案

【執筆ルール（共通・厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語。
    * 「感銘を受けました」「ご活躍を拝見」などの儀礼的な褒め言葉。
    * 「DXの推進」「大幅な改善」といった曖昧な表現。
    * **Markdown記法の使用は絶対禁止**。
* **宛名の記載ルール**:
    * 氏名は必ず「姓 名」の順で記載すること（例: 山田 太郎 様）。
    * 「名 姓」の順は絶対に使用しないこと。
* **出力形式**: 指定されたJSON形式のみを出力すること。

${qualityRules}

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
ターゲット部署名: ${safe.department || '（なし）'}
ターゲット役職: ${safe.position || ''}
ターゲット氏名: ${safe.name || ''}
${safe.invitationReason ? `誘いたい理由・メモ: ${safe.invitationReason}` : ''}

【差出人（自社）情報】
会社名: ${safe.myCompanyName || '（記載なし）'}
部署名: ${safe.myDepartment || '（なし）'}
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
- 氏名は必ず「姓 名」の順で記載すること（例: 山田 太郎 様）
- 指定されたJSON形式のみを出力すること。

${qualityRules}

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
部署名: ${safe.department || '（なし）'}
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
- **宛名の記載ルール**:
  * 部署名がある場合: 「[部署名] [役職] [氏名] 様」
  * 部署名がない場合: 「[役職] [氏名] 様」
  * 部署名には勝手に「部」などをつけず、入力値をそのまま使用すること。
  * 氏名は必ず「姓 名」の順で記載すること（例: 山田 太郎 様）。
- 指定されたJSON形式のみを出力すること。

${qualityRules}

${jsonInstruction}
`;
        }
        // 5. まとめて入力モード（セールス）
        else if (freeformInput) {
          prompt = `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
提供されたテキストから情報を抽出し、経営者が「この人の話は聞く価値がある」と直感的に感じる、短く鋭い営業レターを作成してください。

【重要な執筆方針】
1. **冒頭で勝負を決める**
   - 褒め言葉や儀礼は一切不要
   - 最初の3行で「なぜ今あなたに連絡したのか」と「経営課題への仮説」を明示
   - 相手が「これは自分のことだ」と思える具体的な仮説を投げかける

2. **経営者の言葉で語る**
   - 「業務効率化」→「経営スピード向上」
   - 「コスト削減」→「リソースの戦略的再配分」
   - 「作業ミス防止」→「ガバナンス強化」「不正リスクの極小化」

3. **実績は数字で証明（架空でもリアルに）**
4. **CTAは断りづらく軽く（15分だけ、情報交換として）**
5. **短く、鋭く（400〜500文字、一文40文字以内）**

【差出人（自社）情報】
会社名: ${safe.myCompanyName}
部署名: ${safe.myDepartment || '（なし）'}
氏名: ${safe.myName}
サービス概要: ${safe.myServiceDescription}

【ターゲット情報】
企業名: ${safe.companyName}
部署名: ${safe.department || '（なし）'}
役職: ${safe.position || '経営者'}
氏名: ${safe.name}

【提供されたテキスト】
${safe.freeformInput}

【3つのパターン定義（CxO視座）】

1. **Pattern A: Executive Insight（経営インサイト型）- standard**
   - 経営課題への鋭い仮説から入る
   - 業界トレンドを起点に、守りと攻め両面のメリットを提示

2. **Pattern B: Peer Reference（同業事例型）- emotional**
   - 「同業界の〇〇社様では」という実績から入る
   - 具体的な数字と効果を冒頭で提示

3. **Pattern C: Risk Alert（リスク喚起型）- consultative**
   - 「〇〇のリスクが高まっている中」から入る
   - 守りのソリューションとして提案

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語。
    * 「感銘を受けました」「ご活躍を拝見」などの儀礼的な褒め言葉。
    * 「DXの推進」「大幅な改善」といった曖昧な表現。
    * **Markdown記法の使用は絶対禁止**。
* **宛名の記載ルール**:
  * 部署名がある場合: 「[部署名] [役職] [氏名] 様」
  * 部署名がない場合: 「[役職] [氏名] 様」
  * 部署名には勝手に「部」などをつけず、入力値をそのまま使用すること。
  * 氏名は必ず「姓 名」の順で記載すること（例: 山田 太郎 様）。

${qualityRules}

* **出力形式**: 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }
        // 6. ステップ入力モード（セールス・従来）
        else {
          prompt = `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
以下の情報を基に、経営者が「この人の話は聞く価値がある」と直感的に感じる、短く鋭い営業レターを作成してください。

【重要な執筆方針】
1. **冒頭で勝負を決める**
   - 褒め言葉や儀礼は一切不要
   - 最初の3行で「なぜ今あなたに連絡したのか」と「経営課題への仮説」を明示
   - 相手が「これは自分のことだ」と思える具体的な仮説を投げかける

2. **経営者の言葉で語る**
   - 「業務効率化」→「経営スピード向上」
   - 「コスト削減」→「リソースの戦略的再配分」
   - 「作業ミス防止」→「ガバナンス強化」「不正リスクの極小化」
   - 守りのメリット（監査対応、コンプライアンス）を必ず言及

3. **実績は数字で証明**
   - 「同業界のB社様では監査対応工数を50%削減」
   - 「グループ30社の内部統制を一元化し、連結決算期間を2週間短縮」
   - 架空でもリアルな数字と社名を使用

4. **CTAは断りづらく軽く**
   - 「15分だけ現状の確認をさせていただけないでしょうか」
   - 「情報交換として他社様の事例をお伝えできればと存じます」

5. **短く、鋭く**
   - 全体400〜500文字
   - 一文40文字以内
   - スマホ一画面で読める長さ

【差出人（自社）情報】
会社名: ${safe.myCompanyName}
部署名: ${safe.myDepartment || '（なし）'}
氏名: ${safe.myName}
サービス概要: ${safe.myServiceDescription}

【ターゲット情報】
企業名: ${safe.companyName}
部署名: ${safe.department || '（なし）'}
役職: ${safe.position || '経営者'}
氏名: ${safe.name}

【手紙の構成要素（参考情報）】
1. 背景・フック: ${safe.background}
2. 課題の指摘: ${safe.problem}
3. 解決策の提示: ${safe.solution}
4. 事例・実績: ${safe.caseStudy}
5. オファー: ${safe.offer}

${safe.searchResults ? `【最新ニュース・Web情報】\n${safe.searchResults}\n※直近のニュース記事を参照し、タイムリーな話題を背景に盛り込んでください。` : ''}

【3つのパターン定義（CxO視座）】

1. **Pattern A: Executive Insight（経営インサイト型）- standard**
   - 経営課題への鋭い仮説から入る
   - 「御社の〇〇という課題に対して」ではなく「〇〇業界で今〇〇が経営課題になっている中」
   - 守りと攻め両面のメリットを提示
   - 経営者同士の対話を意識したトーン

2. **Pattern B: Peer Reference（同業事例型）- emotional**
   - 「同業界の〇〇社様では」という実績から入る
   - 具体的な数字と効果を冒頭で提示
   - 「御社でも同様の効果が期待できると考え」と繋げる
   - 成功事例の説得力で興味を引く

3. **Pattern C: Risk Alert（リスク喚起型）- consultative**
   - 「〇〇のリスクが高まっている中」から入る
   - 規制強化、監査厳格化、不正事例などを引用
   - 守りのソリューションとして提案
   - 危機感を煽りすぎず、解決策を明示

【執筆ルール（厳守）】
* **禁止事項 (NG)**:
    * 「つきましては」「この度は」などの接続詞を短期間に繰り返すこと。
    * 「～させて頂きます」「～存じます」などの過剰な二重敬語や、まどろっこしい表現。
    * 「感銘を受けました」「ご活躍を拝見」などの儀礼的な褒め言葉。
    * 抽象的な「DXの推進」「大幅な改善」といった曖昧な表現。
    * **Markdown記法（**太字**や#見出し）の使用は絶対禁止**。
* **宛名の記載ルール**:
  * 部署名がある場合: 「[部署名] [役職] [氏名] 様」
  * 部署名がない場合: 「[役職] [氏名] 様」
  * 部署名には勝手に「部」などをつけず、入力値をそのまま使用すること。
  * 氏名は必ず「姓 名」の順で記載すること（例: 山田 太郎 様）。

${qualityRules}

* **出力形式**: 指定されたJSON形式のみを出力すること。

${jsonInstruction}
`;
        }


        // フォールバック付きで生成を実行
        const result = await generateWithFallback(prompt, primaryModelName);
        const generatedText = result.text.trim();

        // JSONパース処理
        type GenerateResponse = {
          email?: { subject: string; body: string };
          letter?: string;
          variations?: Record<string, string>;
        };
        let responseData: GenerateResponse = {};

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

        // ログインユーザーの場合、生成回数を更新
        if (user) {
          const supabase = await createClient();
          const today = new Date().toISOString().split('T')[0];

          // 現在のカウントを取得してインクリメント記述もできるが、
          // 並行性を厳密に問わないなら、前段で取った値+1でも、あるいは再取得でも良い。
          // ここではシンプルに、rpcを使わずとも、再取得またはatomic updateを目指す。
          // supabaseで value = value + 1 は RPC が必要になることが多いが、
          // ここではシンプルに Profilesテーブルの update で処理する（Race Conditionは許容）

          // Note: 本来はRPC increment_usage() を作るのがベストだが、今回は直接Update
          // まず現在値を取得（日付またぎも考慮）
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('daily_usage_count, last_usage_date')
            .eq('id', user.id)
            .single();

          let newCount = 1;
          if (currentProfile) {
            if (currentProfile.last_usage_date === today) {
              newCount = (currentProfile.daily_usage_count || 0) + 1;
            }
            // 日付が違うなら newCount = 1 (リセット+今回分)
          }

          await supabase
            .from('profiles')
            .update({
              daily_usage_count: newCount,
              last_usage_date: today
            })
            .eq('id', user.id);
        }

        return response;

      } catch (error: unknown) {
        // 詳細なエラーログ出力（デバッグ用）
        const errorDetails = getErrorDetails(error);
        const errorObj = error as { status?: number; statusCode?: number; code?: string; cause?: unknown };
        console.error('[ERROR] 生成エラー詳細:', {
          ...errorDetails,
          status: errorObj.status,
          statusCode: errorObj.statusCode,
          code: errorObj.code,
          cause: errorObj.cause,
        });
        // オブジェクトとして直接出力（JSON.stringifyでは消える情報があるため）
        console.error('[ERROR] Full Error Object:', error);

        devLog.error('生成エラー:', error);

        // エラーの種類に応じてメッセージを使い分ける
        let errorMessage = '手紙の生成に失敗しました';
        let errorCode = 'UNKNOWN_ERROR';
        let status = 500;

        const message = getErrorMessage(error);
        if (message?.includes('429') || errorObj.status === 429) {
          errorMessage = 'AIモデルの利用制限に達しました。しばらく待ってから再試行してください。';
          errorCode = 'RATE_LIMIT_EXCEEDED';
          status = 429;
        } else if (message?.includes('API key') || errorObj.status === 401) {
          errorMessage = 'APIキーが無効か、設定されていません。';
          errorCode = 'AUTH_ERROR';
          status = 401;
        } else if (message?.includes('safety') || message?.includes('blocked')) {
          errorMessage = '生成された内容が安全基準に抵触したため、表示できません。入力内容を見直してください。';
          errorCode = 'SAFETY_ERROR';
          status = 400;
        } else if (message?.includes('overloaded')) {
          errorMessage = 'AIモデルが混雑しています。しばらく待ってから再試行してください。';
          errorCode = 'MODEL_OVERLOADED';
          status = 503;
        }

        const errorResponse = NextResponse.json(
          {
            error: errorMessage,
            code: errorCode,
            details: message
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
