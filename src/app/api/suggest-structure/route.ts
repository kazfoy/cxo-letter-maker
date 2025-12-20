import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

// 入力スキーマ定義
const SuggestStructureSchema = z.object({
  companyName: z.string().min(1, '企業名は必須です'),
  myServiceDescription: z.string().min(1, '自社サービス概要は必須です'),
  background: z.string().optional(),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    SuggestStructureSchema,
    async (data, user) => {
      try {
        const { companyName, myServiceDescription, background } = data;

    const model = google('gemini-1.5-flash');

    const prompt = `あなたはCxO向けセールスレターの構成案を提案する専門家です。

【タスク】
以下の情報を基に、手紙の切り口（アプローチ方法）として3つのパターンを提案してください。

【ターゲット企業】
${companyName}

【自社サービス概要】
${myServiceDescription}

${background ? `【解析されたコンテキスト】\n${background}\n` : ''}

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
- ${companyName}と${myServiceDescription}の内容を踏まえた、カスタマイズされた提案にしてください

それでは、3つのアプローチ案を提案してください。`;

    const result = await generateText({
      model: model,
      prompt: prompt,
    });
    const responseText = result.text;

    // JSONを抽出（```json で囲まれている場合があるため）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Invalid JSON response:', responseText);
      throw new Error('Invalid JSON response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

        // バリデーション
        if (!parsed.approaches || !Array.isArray(parsed.approaches) || parsed.approaches.length !== 3) {
          throw new Error('Invalid response structure');
        }

        return NextResponse.json(parsed);
      } catch (error) {
        console.error('構成案生成エラー:', error);
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
