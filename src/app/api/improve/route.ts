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
const ImproveSchema = z.object({
  content: z.string().min(1, 'コンテンツは必須です'),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    ImproveSchema,
    async (data, user) => {
      try {
        const { content } = data;

    // Gemini Pro を使用（品質改善）
    const model = google('gemini-2.0-flash-exp');

    const improvePrompt = `あなたは一流のビジネスライターです。
以下の営業手紙を、より説得力があり、経営層の心に響く内容に改善してください。

【改善ポイント】
- 表現の洗練: より適切な語彙や言い回しを使用
- 論理性の強化: 主張の流れをより明確に
- 具体性の向上: 抽象的な表現を具体的に
- 感情的訴求: 理性だけでなく、共感を呼ぶ要素を追加
- 読みやすさ: 文章のリズムや長さを最適化

元の構成や要素（5つの構成要素）は維持しつつ、質を向上させてください。

【元の手紙】
${content}

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること

【改善版の手紙】`;

        const result = await generateText({
          model: model,
          prompt: improvePrompt,
        });
        const improvedLetter = result.text;

        return NextResponse.json({ improvedLetter });
      } catch (error) {
        console.error('品質改善エラー:', error);
        return NextResponse.json(
          { error: '品質改善に失敗しました' },
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
