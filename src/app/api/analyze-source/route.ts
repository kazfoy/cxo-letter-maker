import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    // FormDataを解析
    const formData = await request.formData();
    const urlsJson = formData.get('urls') as string;
    const pdfText = formData.get('pdfText') as string | null; // PDFファイルではなくテキストを受け取る

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const extractPrompt = `以下の複数のソース（WebページとPDF）から企業情報を抽出してJSON形式で返してください。

【ソーステキスト】
${combinedText}

【抽出する情報】
- companyName: 会社名（複数ソースで一致する名前を優先、見つからない場合は空文字）
- personName: 氏名（見つかった場合のみ、見つからない場合は空文字）
- summary: 事業概要の統合サマリー（100-200文字程度）
- context: 手紙のフックになりそうな話題（ニュース、課題感、新規事業など、最新情報を優先、50-100文字程度）

【出力形式】
JSON形式で返してください（説明文は不要）：
{
  "companyName": "会社名",
  "personName": "氏名",
  "summary": "統合サマリー",
  "context": "フックになる話題"
}

※ JSONのみを返してください。説明文は不要です。`;

    const result = await model.generateContent(extractPrompt);
    const responseText = result.response.text();

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
