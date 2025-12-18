import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// APIキーが読み込めているか確認するログを追加
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log("API Key configured (analyze-source):", apiKey ? "Yes (Length: " + apiKey.length + ")" : "No");

if (!apiKey) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
}

// Googleプロバイダーを初期化（APIキーを明示的に渡す）
const google = createGoogleGenerativeAI({
  apiKey: apiKey,
});

export async function POST(request: Request) {
  try {
    // FormDataを解析
    const formData = await request.formData();
    const urlsJson = formData.get('urls') as string;
    const pdfText = formData.get('pdfText') as string | null; // PDFファイルではなくテキストを受け取る
    const isEventUrl = formData.get('isEventUrl') === 'true'; // イベントURL解析フラグ

    if (!urlsJson && !pdfText) {
      return NextResponse.json(
        { error: 'URLまたはPDFテキストを指定してください' },
        { status: 400 }
      );
    }

    let urls: string[] = [];
    if (urlsJson) {
      try {
        urls = JSON.parse(urlsJson);
        if (!Array.isArray(urls)) {
          throw new Error('Invalid URLs format');
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'URL形式が不正です' },
          { status: 400 }
        );
      }
    }

    const extractedTexts: string[] = [];

    // 複数URLからテキスト抽出（並列処理）
    if (urls.length > 0) {
      const urlResults = await Promise.allSettled(
        urls.map(async (url, index) => {
          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // 不要な要素を削除
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            $('header').remove();

            // メインコンテンツを抽出
            let mainText = '';
            const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];

            for (const selector of mainSelectors) {
              const element = $(selector);
              if (element.length > 0) {
                mainText = element.text();
                break;
              }
            }

            // テキストをクリーンアップ
            const cleanedText = mainText
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 5000);

            if (cleanedText.length < 50) {
              throw new Error('有効なコンテンツが見つかりません');
            }

            return {
              source: `URL ${index + 1}`,
              text: cleanedText,
            };
          } catch (error) {
            console.warn(`URL ${index + 1} extraction failed:`, error);
            throw error;
          }
        })
      );

      // 成功したURLのテキストを収集
      urlResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          extractedTexts.push(`=== ${result.value.source} ===\n${result.value.text}`);
        }
      });
    }

    // PDFテキストを追加（フロントエンドで既に抽出済み）
    if (pdfText && pdfText.trim().length >= 50) {
      const cleanedPdfText = pdfText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
      extractedTexts.push(`=== PDF Document ===\n${cleanedPdfText}`);
    }

    // すべてのソースが失敗した場合
    if (extractedTexts.length === 0) {
      return NextResponse.json(
        { error: 'すべてのソースからの情報抽出に失敗しました' },
        { status: 500 }
      );
    }

    // テキストを結合（最大10,000文字）
    const combinedText = extractedTexts.join('\n\n').substring(0, 10000);

    // Gemini APIで情報を抽出
    const model = google('gemini-2.0-flash-exp');

    let extractPrompt: string;

    if (isEventUrl) {
      // イベントURL解析用プロンプト
      extractPrompt = `以下のソース（WebページまたはPDF）からイベント情報を抽出してJSON形式で返してください。

【ソーステキスト】
${combinedText}

【抽出する情報】
- eventName: イベント名（見つからない場合は空文字）
- eventDateTime: 開催日時と場所の情報（例: "2025年1月15日（水）14:00-17:00 / 東京国際フォーラム"、見つからない場合は空文字）
- eventSpeakers: 主要登壇者やゲストのリスト
  * **重要**: 氏名だけでなく、所属企業・団体、部署、役職まで必ず抽出すること
  * **出力フォーマット**: 「氏名 (所属企業名 役職)」の形式で統一すること
  * 例: "山田 太郎 (株式会社サンプル 営業本部 部長)、田中 花子 (△△大学 教授)"
  * 複数の登壇者がいる場合は、カンマ区切りで列挙すること
  * 役職情報が見つからない場合のみ、氏名と所属企業のみでも可
  * 見つからない場合は空文字

【出力形式】
JSON形式で返してください（説明文は不要）：
{
  "eventName": "イベント名",
  "eventDateTime": "開催日時・場所",
  "eventSpeakers": "主要登壇者/ゲスト"
}

※ JSONのみを返してください。説明文は不要です。`;
    } else {
      // 通常の企業情報抽出プロンプト
      extractPrompt = `以下の複数のソース（WebページとPDF）から企業情報を抽出してJSON形式で返してください。

【ソーステキスト】
${combinedText}

【抽出する情報】
- companyName: 会社名（複数ソースで一致する名前を優先、見つからない場合は空文字）
- personName: 氏名（見つかった場合のみ、見つからない場合は空文字）
- personPosition: 役職（personNameが見つかった場合、その人の役職も抽出する。見つからない場合は空文字）
- summary: 事業概要の統合サマリー（100-200文字程度）
- context: 手紙のフックになりそうな話題（ニュース、課題感、新規事業など、最新情報を優先、50-100文字程度）

【出力形式】
JSON形式で返してください（説明文は不要）：
{
  "companyName": "会社名",
  "personName": "氏名",
  "personPosition": "役職",
  "summary": "統合サマリー",
  "context": "フックになる話題"
}

※ JSONのみを返してください。説明文は不要です。`;
    }

    const result = await generateText({
      model: model,
      prompt: extractPrompt,
    });
    const responseText = result.text;

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'AI解析結果のJSON抽出に失敗しました' },
        { status: 500 }
      );
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      data: extractedData,
      sources: {
        urlsProcessed: extractedTexts.filter(t => t.includes('URL')).length,
        pdfProcessed: extractedTexts.some(t => t.includes('PDF')),
      },
    });
  } catch (error) {
    console.error('ソース解析エラー:', error);
    return NextResponse.json(
      { error: 'ソース解析に失敗しました' },
      { status: 500 }
    );
  }
}
