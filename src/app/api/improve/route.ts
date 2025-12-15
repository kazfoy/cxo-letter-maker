import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content } = body;

    // Gemini Pro を使用（品質改善）
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

【改善版の手紙】`;

    const result = await model.generateContent(improvePrompt);
    const improvedLetter = result.response.text();

    return NextResponse.json({ improvedLetter });
  } catch (error) {
    console.error('品質改善エラー:', error);
    return NextResponse.json(
      { error: '品質改善に失敗しました' },
      { status: 500 }
    );
  }
}
