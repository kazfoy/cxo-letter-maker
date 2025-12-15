import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, editType } = body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    let editPrompt = '';

    switch (editType) {
      case 'casual':
        editPrompt = `以下の営業手紙をよりカジュアルで親しみやすい表現に書き換えてください。
ただし、ビジネスマナーは保ち、失礼のない範囲で調整してください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${content}

【カジュアル版の手紙】`;
        break;

      case 'emphasize':
        editPrompt = `以下の営業手紙で、事例・実績の部分をより強調して書き換えてください。
具体的な数字や成果があれば目立つように配置し、説得力を高めてください。
元の手紙の構成や他の要素は維持してください。

【元の手紙】
${content}

【事例強調版の手紙】`;
        break;

      case 'shorten':
        editPrompt = `以下の営業手紙を、重要なポイントを残しつつ、より簡潔に（600〜800文字程度に）短縮してください。
5つの構成要素はすべて含めてください。

【元の手紙】
${content}

【短縮版の手紙】`;
        break;

      case 'passionate':
        editPrompt = `以下の営業手紙を、より情熱的で熱意が伝わる表現に書き換えてください。
ただし、過度に感情的になりすぎず、プロフェッショナルな印象は保ってください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${content}

【情熱的な手紙】`;
        break;

      case 'concise':
        editPrompt = `以下の営業手紙を、元の長さの約8割（元の文字数の80%程度）に簡潔化してください。
重要な情報を残しつつ、冗長な表現を削ってください。
5つの構成要素はすべて含めてください。

【元の手紙】
${content}

【簡潔版の手紙】`;
        break;

      case 'businesslike':
        editPrompt = `以下の営業手紙を、よりビジネスライクでフォーマルな表現に修正してください。
丁寧で格式のある言葉遣いを使い、プロフェッショナルな印象を強めてください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${content}

【ビジネスライク版の手紙】`;
        break;

      case 'proofread':
        editPrompt = `以下の営業手紙の誤字脱字、文法ミス、不自然な表現をチェックし、修正してください。
また、より適切な語彙や表現があれば改善してください。
基本的な内容や構成は変更せず、品質の向上のみを行ってください。

【元の手紙】
${content}

【校正後の手紙】`;
        break;

      default:
        return NextResponse.json(
          { error: '無効な編集タイプです' },
          { status: 400 }
        );
    }

    const result = await model.generateContent(editPrompt);
    const editedLetter = result.response.text();

    return NextResponse.json({ editedLetter });
  } catch (error) {
    console.error('編集エラー:', error);
    return NextResponse.json(
      { error: '編集に失敗しました' },
      { status: 500 }
    );
  }
}
