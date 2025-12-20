import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log("API Key configured (analyze-url):", apiKey ? "Yes (Length: " + apiKey.length + ")" : "No");

const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

// 入力スキーマ定義
const AnalyzeUrlSchema = z.object({
  url: z.string().url('有効なURLを入力してください'),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    AnalyzeUrlSchema,
    async (data, user) => {
      try {
        const { url } = data;

    // URLからHTMLを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'URLの取得に失敗しました' },
        { status: 500 }
      );
    }

    const html = await response.text();

    // cheerioでHTMLをパース
    const $ = cheerio.load(html);

    // 不要な要素を削除
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove();

    // メインコンテンツを抽出
    let mainText = '';

    // よくあるメインコンテンツのセレクタを試す
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];

    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainText = element.text();
        break;
      }
    }

    // テキストをクリーンアップ
    mainText = mainText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // 最大5000文字に制限

    if (!mainText || mainText.length < 50) {
      return NextResponse.json(
        { error: '有効なコンテンツを抽出できませんでした' },
        { status: 500 }
      );
    }

    // Gemini APIで情報を抽出
    const model = google('gemini-2.0-flash-exp');

    const extractPrompt = `以下のWebページのテキストから、企業情報を抽出してJSON形式で返してください。

【Webページのテキスト】
${mainText}

【抽出する情報】
- companyName: 会社名（見つからない場合は空文字）
- personName: 氏名（見つからない場合は空文字）
- summary: 事業概要や記事の要約（100-200文字程度）
- context: 手紙のフックになりそうな話題（ニュース、課題感、新規事業など、50-100文字程度）

【出力形式】
JSON形式で返してください：
{
  "companyName": "会社名",
  "personName": "氏名",
  "summary": "要約",
  "context": "フックになる話題"
}

※ JSONのみを返してください。説明文は不要です。`;

    const result = await generateText({
      model: model,
      prompt: extractPrompt,
    });
    const responseText = result.text;

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'JSONの抽出に失敗しました' },
        { status: 500 }
      );
    }

    const extractedData = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
          success: true,
          data: extractedData,
        });
      } catch (error) {
        console.error('URL解析エラー:', error);
        return NextResponse.json(
          { error: 'URL解析に失敗しました' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: {
        windowMs: 60000, // 1分
        maxRequests: 10, // 外部アクセス系は厳しく制限
      },
    }
  );
}
