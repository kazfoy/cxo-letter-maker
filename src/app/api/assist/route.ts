import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log("API Key configured (assist):", apiKey ? "Yes (Length: " + apiKey.length + ")" : "No");

const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { field, companyName, myServiceDescription } = body;

    const model = google('gemini-2.0-flash-exp');

    let assistPrompt = '';

    switch (field) {
      case 'background':
        assistPrompt = `【タスク】
営業手紙の「背景・フック」セクションの候補を3つ提案してください。

【ターゲット企業】
${companyName}

【自社サービス】
${myServiceDescription}

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
${companyName}

【自社サービス】
${myServiceDescription}

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
${companyName}

【自社サービス】
${myServiceDescription}

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
${companyName}

【自社サービス】
${myServiceDescription}

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
${companyName}

【自社サービス】
${myServiceDescription}

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

    const result = await generateText({
      model: model,
      prompt: assistPrompt,
    });
    const responseText = result.text;

    // JSONを抽出（```json で囲まれている場合があるため）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AIアシストエラー:', error);
    return NextResponse.json(
      { error: 'AIアシストに失敗しました' },
      { status: 500 }
    );
  }
}
