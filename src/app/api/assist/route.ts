import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import { getGoogleProvider, MODEL_DEFAULT, extractJsonFromResponse } from '@/lib/gemini';

export const maxDuration = 60;

// 入力スキーマ定義（文字数制限を追加）
const AssistSchema = z.object({
  field: z.string().min(1, 'フィールドは必須です').max(100, 'フィールド名は100文字以内で入力してください'),
  companyName: z.string().max(200, '企業名は200文字以内で入力してください').optional(),
  myServiceDescription: z.string().max(2000, 'サービス概要は2000文字以内で入力してください').optional(),
  mode: z.string().max(50, 'モードは50文字以内で入力してください').optional(),
  eventName: z.string().max(300, 'イベント名は300文字以内で入力してください').optional(),
  eventDateTime: z.string().max(300, '開催日時・場所は300文字以内で入力してください').optional(),
  eventSpeakers: z.string().max(1000, '登壇者情報は1000文字以内で入力してください').optional(),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    AssistSchema,
    async (data, _user) => {
      try {
        const {
          field,
          companyName,
          myServiceDescription,
          mode,
          eventName,
          eventDateTime,
          eventSpeakers,
        } = data;

        // プロンプトインジェクション対策
        const safeCompanyName = sanitizeForPrompt(companyName || '', 200);
        const safeServiceDescription = sanitizeForPrompt(myServiceDescription || '', 2000);
        const safeEventName = sanitizeForPrompt(eventName || '', 300);
        const safeEventDateTime = sanitizeForPrompt(eventDateTime || '', 300);
        const safeEventSpeakers = sanitizeForPrompt(eventSpeakers || '', 1000);

        const google = getGoogleProvider();
        const model = google(MODEL_DEFAULT);

        let assistPrompt = '';

        // イベントモードの招待理由
        if (field === 'invitationReason' && mode === 'event') {
          assistPrompt = `【タスク】
イベント招待状の「招待の背景（Why You?）」セクションの候補を3つ提案してください。

【招待先企業】
${safeCompanyName}

【自社サービス/事業】
${safeServiceDescription}

【イベント情報】
イベント名: ${safeEventName || '未入力'}
開催日時・場所: ${safeEventDateTime || '未入力'}
主要登壇者/ゲスト: ${safeEventSpeakers || '未入力'}

【招待の背景（Why You?）とは】
なぜその人をイベントに招待したいのか、その理由や期待することを記述する。以下の切り口を参考に：
- 学びの提供（イベント内容が相手の事業や課題に役立つ理由）
- ネットワーキング（参加者や登壇者との出会いの価値）
- 意見交換（相手の知見や視点を求めている）
- 業界への貢献（相手の参加が業界にとって意義がある）

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
        } else {
          // セールスモード用のswitch文
          switch (field) {
            case 'background':
              assistPrompt = `【タスク】
営業手紙の「背景・フック」セクションの候補を3つ提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス】
${safeServiceDescription}

【背景・フックとは】
なぜ今、その企業にアプローチするのか。ニュースや決算情報、業界動向などから言及し、興味を引く。

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
              break;

            case 'problem':
              assistPrompt = `【タスク】
営業手紙の「課題の指摘」セクションの候補を3つ提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス】
${safeServiceDescription}

【課題の指摘とは】
業界特有の課題や、成長企業が陥りやすい壁への共感を示す。

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
              break;

            case 'solution':
              assistPrompt = `【タスク】
営業手紙の「解決策の提示」セクションの候補を3つ提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス】
${safeServiceDescription}

【解決策の提示とは】
自社ソリューションによる解決アプローチを提示する。売り込みすぎない。

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
              break;

            case 'caseStudy':
              assistPrompt = `【タスク】
営業手紙の「事例・実績」セクションの候補を3つ提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス】
${safeServiceDescription}

【事例・実績とは】
同業他社や類似ステージ企業での実績を紹介し、信頼性を高める。

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
              break;

            case 'offer':
              assistPrompt = `【タスク】
営業手紙の「オファー」セクションの候補を3つ提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス】
${safeServiceDescription}

【オファーとは】
具体的なアクション（情報交換の時間をください、など）を提案する。

【出力形式】
JSON形式で3つの候補を返してください：
{
  "suggestions": [
    "候補1のテキスト",
    "候補2のテキスト",
    "候補3のテキスト"
  ]
}`;
              break;

            default:
              return NextResponse.json(
                { error: '無効なフィールドです' },
                { status: 400 }
              );
          }
        }

        const result = await generateText({
          model: model,
          prompt: assistPrompt,
        });
        const responseText = result.text;

        // JSON抽出（gemini.ts の共通クリーナーを使用）
        const AssistResponseSchema = z.object({
          suggestions: z.array(z.string()).min(1).max(5),
        });

        let parsed;
        try {
          const jsonString = extractJsonFromResponse(responseText);
          parsed = AssistResponseSchema.parse(JSON.parse(jsonString));
        } catch (parseError) {
          devLog.error(`[assist] JSONパース失敗 (model=${MODEL_DEFAULT}):`, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            promptHead: assistPrompt.substring(0, 200),
            responseHead: responseText.substring(0, 200),
          });
          return NextResponse.json(
            { error: 'レスポンスの解析に失敗しました' },
            { status: 500 }
          );
        }

        return NextResponse.json(parsed);
      } catch (error) {
        devLog.error('AIアシストエラー:', error);
        return NextResponse.json(
          { error: 'AIアシストに失敗しました' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: {
        windowMs: 60000,
        maxRequests: 30,
      },
    }
  );
}
