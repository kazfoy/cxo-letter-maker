import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

// APIキーが読み込めているか確認するログを追加
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log("API Key configured:", apiKey ? "Yes (Length: " + apiKey.length + ")" : "No");

if (!apiKey) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
}

// Googleプロバイダーを初期化（APIキーを明示的に渡す）
const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      myCompanyName,
      myName,
      myServiceDescription,
      companyName,
      position,
      name,
      background,
      problem,
      solution,
      caseStudy,
      offer,
      freeformInput,
      model = 'flash',
    } = body;

    // モデル選択
    const modelName = model === 'pro' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp';
    const geminiModel = google(modelName);

    // まとめて入力モードの場合
    if (freeformInput) {
      const prompt = `あなたはCxO向けセールスレターの専門家です。
提供されたテキストから、CxOレターの5つの要素（背景・課題・解決策・実績・オファー）を抽出し、形式に沿って営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${myCompanyName}
氏名: ${myName}
サービス概要: ${myServiceDescription}

【ターゲット情報】
企業名: ${companyName}
役職: ${position || '経営者'}
氏名: ${name}

【提供されたテキスト】
${freeformInput}

【作成ルール】
- 提供されたテキストから、以下の5要素を抽出・再構成すること：
  1. 背景・フック（なぜ今、その企業にアプローチするのか）
  2. 課題の指摘（業界や企業の課題）
  3. 解決策の提示（自社サービスによる解決策）
  4. 事例・実績（具体的な成果）
  5. オファー（具体的なアクション）
- 文字数: 800〜1200文字程度
- トーン: 丁寧だが堅苦しくない、ビジネスライク
- 売り込み感を抑え、価値提供を前面に出す
- 具体的で、読み手の状況に寄り添った内容にする
- 宛名は「${companyName} ${position ? position + ' ' : ''}${name}様」で始める
- 末尾は「${myCompanyName}\n${myName}」で締める

それでは、手紙本文を作成してください。`;

      const result = await generateText({
        model: geminiModel,
        prompt: prompt,
      });
      const letter = result.text;
      return NextResponse.json({ letter });
    }

    // ステップ入力モードの場合（従来のロジック）
    const prompt = `あなたはCxO向けセールスレターの専門家です。
以下の情報を基に、経営層に「会いたい」と思わせる営業手紙を作成してください。

【差出人（自社）情報】
会社名: ${myCompanyName}
氏名: ${myName}
サービス概要: ${myServiceDescription}

【ターゲット情報】
企業名: ${companyName}
役職: ${position || '経営者'}
氏名: ${name}

【手紙の構成要素（5つの要素）】
1. 背景・フック: ${background}
2. 課題の指摘: ${problem}
3. 解決策の提示: ${solution}
4. 事例・実績: ${caseStudy}
5. オファー: ${offer}

【作成ルール】
- 上記5要素を必ず含めること
- 文字数: 800〜1200文字程度
- トーン: 丁寧だが堅苦しくない、ビジネスライク
- 売り込み感を抑え、価値提供を前面に出す
- 具体的で、読み手の状況に寄り添った内容にする
- 自社サービス概要を踏まえた、具体的な提案を含める
- 宛名は「${companyName} ${position ? position + ' ' : ''}${name}様」で始める
- 末尾は「${myCompanyName}\n${myName}」で締める

それでは、手紙本文を作成してください。`;

    const result = await generateText({
      model: geminiModel,
      prompt: prompt,
    });
    const letter = result.text;

    return NextResponse.json({ letter });
  } catch (error) {
    console.error('生成エラー:', error);
    return NextResponse.json(
      { error: '手紙の生成に失敗しました' },
      { status: 500 }
    );
  }
}
