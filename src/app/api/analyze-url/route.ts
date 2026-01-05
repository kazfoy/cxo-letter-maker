import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { safeFetch } from '@/lib/url-validator';
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

        // SSRF対策: safeFetchを使用（URL検証、タイムアウト、サイズ制限）
        let response: Response;
        try {
          response = await safeFetch(
            url,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            },
            10000, // 10秒タイムアウト
            5 * 1024 * 1024 // 5MB制限
          );
        } catch (error) {
          devLog.error('URL fetch error:', error);
          return NextResponse.json(
            {
              error: error instanceof Error ? error.message : 'URLの取得に失敗しました',
            },
            { status: 400 }
          );
        }

        if (!response.ok) {
          return NextResponse.json(
            { error: `URLの取得に失敗しました: HTTP ${response.status}` },
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
        const google = getGoogleProvider();
        const model = google('gemini-1.5-flash');

        const extractPrompt = `以下のWebページのテキストから、企業情報を抽出してJSON形式で返してください。

【Webページのテキスト】
${mainText}

【抽出する情報】
- companyName: 会社名（ページから特定できる正式名称）
- personName: 代表者名や担当者名（見つからない場合は空文字）
- summary: 事業概要（100文字程度で簡潔に）
- description: サービスや強みの説明（200文字程度で具体的に）

【制約事項】
- 必ず有効なJSON形式のみを出力してください
- Markdownのコードブロック（\`\`\`jsonなど）を含めないでください
- 確信が持てない項目は空文字にしてください

【出力JSON例】
{
  "companyName": "株式会社サンプル",
  "personName": "代表 太郎",
  "summary": "クラウドサービスの開発・運営",
  "description": "中小企業向けの業務効率化SaaSを提供しています。..."
}`;

        const result = await generateText({
          model: model,
          prompt: extractPrompt,
        });

        const responseText = result.text.trim();

        // コードブロック除去などのクリーニング
        const cleanedText = responseText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

        let extractedData;
        try {
          extractedData = JSON.parse(cleanedText);
        } catch (e) {
          console.error('JSON Parse Error:', e);
          // 失敗した場合、テキストから無理やり抽出するか、エラーにする
          return NextResponse.json(
            { error: '情報の解析に失敗しました' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          companyName: extractedData.companyName || '',
          personName: extractedData.personName || '',
          summary: extractedData.summary || '',
          description: extractedData.description || extractedData.summary || ''
        });

      } catch (error) {
        devLog.error('URL解析エラー:', error);
        return NextResponse.json(
          { error: 'URL解析に失敗しました' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10,
      },
    }
  );
}
