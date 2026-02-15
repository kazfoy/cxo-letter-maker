import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { safeFetch } from '@/lib/url-validator';
import { extractSafeText } from '@/lib/html-sanitizer';
import { devLog } from '@/lib/logger';
import { getGoogleProvider, MODEL_DEFAULT } from '@/lib/gemini';

export const maxDuration = 60;

// 入力スキーマ定義
const AnalyzeUrlSchema = z.object({
  url: z.string().url('有効なURLを入力してください'),
  type: z.enum(['own', 'target']).optional().default('target'),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    AnalyzeUrlSchema,
    async (data, _user) => {
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

        // cheerioでHTMLをパース + 隠しテキスト除去 + メインコンテンツ抽出
        const $ = cheerio.load(html);
        const mainText = extractSafeText($, 5000);

        if (!mainText || mainText.length < 50) {
          return NextResponse.json(
            { error: '有効なコンテンツを抽出できませんでした' },
            { status: 500 }
          );
        }

        // Gemini APIで情報を抽出
        const google = getGoogleProvider();
        const model = google(MODEL_DEFAULT);

        let extractPrompt: string;

        if (data.type === 'own') {
          extractPrompt = `あなたはセールスライティングの専門家です。以下のWebページのテキストから、自社の情報を抽出し、さらにそのサービスを活用したセールスレターの汎用的な構成案を生成してJSON形式で返してください。

【Webページのテキスト】
${mainText}

【抽出・生成する情報】
1. 基本情報:
- companyName: 会社名
- summary: 事業概要・サービス概要（200文字程度で具体的に）

2. レター構成案（letterStructure）:
自社の強みを活かした、汎用的なセールスレターの構成案を生成してください。
- background: ターゲットが抱えがちな課題・背景（100-150文字）
  * 自社サービスが解決できる「一般的な課題」を提示
- problem: 具体的な課題の深掘り（100-150文字）
  * 自社サービスを導入しないことによるデメリットや、現場の痛み
- solution: 自社ソリューションの提示（100-150文字）
  * 「弊社の〇〇というサービスは」という形式で、自社の強みをアピール
- offer: 結び・ネクストアクション（80-120文字）
  * 「一度詳細をご説明するお時間をいただけないでしょうか」といった標準的なオファー

【出力形式】
JSON形式のみを出力してください（Markdownのコードブロックは不要）：
{
  "companyName": "会社名",
  "summary": "事業概要・サービス概要",
  "letterStructure": {
    "background": "想定されるターゲットの課題",
    "problem": "課題の深掘り",
    "solution": "自社サービスの強み",
    "offer": "結び・オファー"
  }
}`;
        } else {
          extractPrompt = `あなたは企業分析とセールスレター構成の専門家です。以下のWebページのテキストから、ターゲット企業の情報を抽出し、さらにその企業へのセールスレター構成案を生成してJSON形式で返してください。

【Webページのテキスト】
${mainText}

【抽出する情報】
1. 基本情報:
- companyName: 会社名（ページから特定できる正式名称）
- personName: 代表者名や担当者名（見つからない場合は空文字）
- summary: 事業概要（100文字程度で簡潔に）
- description: サービスや強みの説明（200文字程度で具体的に）

2. レター構成案（letterStructure）:
ソーステキストから読み取れる情報を基に、ターゲット企業向けのセールスレター構成案を生成してください。
- background: 相手企業の課題・背景（100-150文字）
  * ソースから読み取れる企業の課題、業界トレンド、最近の動向を反映
  * 情報が少ない場合は、業界一般の課題を仮説として提示
- problem: 具体的な課題の深掘り（100-150文字）
  * 企業が直面しているであろう具体的な問題点
  * 情報が少ない場合は、企業規模や業界から推測される一般的な課題を記載
- solution: 自社ソリューションとの接点（100-150文字）
  * 「御社の〇〇という課題に対して」という形式で、提案の余地を示す
  * 具体的な解決の方向性を示す
- offer: 結び・ネクストアクション（80-120文字）
  * 面談依頼や情報提供のオファー
  * 「ぜひ一度、〇〇についてお話しさせていただければ幸いです」のような形式

【重要な指示】
- 情報が不足している場合でもエラーにせず、会社名や業界から推測される一般的な課題・提案を仮説として生成してください
- letterStructure の各項目は必ず生成してください（空文字は不可）
- 推測で生成した場合は「〜ではないでしょうか」「〜とお見受けいたします」のような表現を使用してください

【出力形式】
JSON形式のみを出力してください（Markdownのコードブロックは不要）：
{
  "companyName": "会社名",
  "personName": "代表者名",
  "summary": "事業概要",
  "description": "サービスや強みの説明",
  "letterStructure": {
    "background": "相手企業の課題・背景",
    "problem": "具体的な課題の深掘り",
    "solution": "自社ソリューションとの接点",
    "offer": "結び・ネクストアクション"
  }
}`;
        }

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
          devLog.error('JSON Parse Error:', e instanceof Error ? e.message : String(e));
          devLog.error('Raw AI Response:', cleanedText.substring(0, 500));
          return NextResponse.json(
            { error: 'AIからの応答を解析できませんでした。もう一度お試しください。' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          companyName: extractedData.companyName || '',
          personName: extractedData.personName || '',
          summary: extractedData.summary || '',
          description: extractedData.description || extractedData.summary || '',
          letterStructure: extractedData.letterStructure
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        devLog.error('URL解析エラー:', errorMessage);

        // エラーの種類に応じた具体的なメッセージを返す
        if (errorMessage.includes('API Key') || errorMessage.includes('GOOGLE')) {
          return NextResponse.json(
            { error: 'AIサービスの設定に問題があります。管理者にお問い合わせください。' },
            { status: 503 }
          );
        }

        return NextResponse.json(
          { error: `URL解析に失敗しました: ${errorMessage}` },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: false,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10,
      },
    }
  );
}
