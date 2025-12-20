import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
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
const SuggestStructureSchema = z.object({
  companyName: z.string().min(1, '企業名は必須です').max(200, '企業名は200文字以内で入力してください'),
  myServiceDescription: z.string().min(1, '自社サービス概要は必須です').max(2000, 'サービス概要は2000文字以内で入力してください'),
  background: z.string().max(5000, '背景情報は5000文字以内で入力してください').optional(),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    SuggestStructureSchema,
    async (data, user) => {
      try {
        const { companyName, myServiceDescription, background } = data;

        // プロンプトインジェクション対策
        const safeCompanyName = sanitizeForPrompt(companyName, 200);
        const safeServiceDescription = sanitizeForPrompt(myServiceDescription, 2000);
        const safeBackground = sanitizeForPrompt(background || '', 5000);

        const google = getGoogleProvider();
        const model = google('gemini-1.5-flash');

        const prompt = `あなたはCxO向けセールスレターの構成案を提案する専門家です。

【タスク】
以下の情報を基に、手紙の切り口（アプローチ方法）として3つのパターンを提案してください。

【ターゲット企業】
${safeCompanyName}

【自社サービス概要】
${safeServiceDescription}

${safeBackground ? `【解析されたコンテキスト】\n${safeBackground}\n` : ''}

【提案する3つのアプローチパターン】
1. **ビジョン共感型**: ターゲット企業の経営理念やビジョン、最近の発信内容への共感から入るアプローチ
2. **課題解決型**: 業界特有の課題や、企業が直面しているであろう問題から入るアプローチ
3. **実績重視型**: 類似企業での成功事例や具体的な実績をフックにするアプローチ

【才流メソッド（5要素）】
各アプローチには以下の要素を含めてください：
- 背景・フック: なぜ今その企業にアプローチするのか
- 課題: 企業が直面している（であろう）課題
- 解決策: 自社サービスによる解決アプローチ
- 実績: 具体的な成果や事例
- オファー: 具体的なアクション提案

【出力形式】
以下のJSON形式で返してください：
{
  "approaches": [
    {
      "type": "vision",
      "title": "【ビジョン共感型】経営理念への共感から入るアプローチ",
      "description": "このアプローチの特徴を1〜2文で説明",
      "draftText": "このアプローチに基づいた手紙の骨子（箇条書き形式で5要素を含む、300〜500文字）"
    },
    {
      "type": "problem",
      "title": "【課題解決型】業界課題から入るアプローチ",
      "description": "このアプローチの特徴を1〜2文で説明",
      "draftText": "このアプローチに基づいた手紙の骨子（箇条書き形式で5要素を含む、300〜500文字）"
    },
    {
      "type": "case",
      "title": "【実績重視型】類似企業の事例をフックにするアプローチ",
      "description": "このアプローチの特徴を1〜2文で説明",
      "draftText": "このアプローチに基づいた手紙の骨子（箇条書き形式で5要素を含む、300〜500文字）"
    }
  ]
}

【重要】
- draftTextは具体的で実用的な内容にしてください
- 箇条書き形式で、各要素（背景・課題・解決・実績・オファー）を明確に区別できるようにしてください
- ユーザーがそのまま「まとめて入力」欄にコピー＆ペーストして使えるレベルの具体性を持たせてください
- ${safeCompanyName}と${safeServiceDescription}の内容を踏まえた、カスタマイズされた提案にしてください

それでは、3つのアプローチ案を提案してください。`;

        const result = await generateText({
          model: model,
          prompt: prompt,
        });
        const responseText = result.text;

        // JSONを抽出（```json で囲まれている場合があるため）
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          devLog.error('Invalid JSON response:', responseText);
          throw new Error('Invalid JSON response');
        }

        // JSON.parseを安全に実行
        let parsed;
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          devLog.error('JSON parse error:', parseError);
          return NextResponse.json(
            { error: 'レスポンスの解析に失敗しました' },
            { status: 500 }
          );
        }

        // バリデーション
        if (!parsed.approaches || !Array.isArray(parsed.approaches) || parsed.approaches.length !== 3) {
          throw new Error('Invalid response structure');
        }

        return NextResponse.json(parsed);
      } catch (error) {
        devLog.error('構成案生成エラー:', error);
        return NextResponse.json(
          { error: '構成案の生成に失敗しました' },
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
