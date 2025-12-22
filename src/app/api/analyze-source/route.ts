import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createErrorResponse, getHttpStatus, ErrorCodes } from '@/lib/apiErrors';
import { authGuard } from '@/lib/api-guard';
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

export async function POST(request: Request) {
  return await authGuard(
    async (user) => {
      try {
        // FormDataを解析
        const formData = await request.formData();
        const urlsJson = formData.get('urls') as string;
        const pdfText = formData.get('pdfText') as string | null; // PDFファイルではなくテキストを受け取る
        const isEventUrl = formData.get('isEventUrl') === 'true'; // イベントURL解析フラグ


        if (!urlsJson && !pdfText) {
          console.error('[ERROR] URLもPDFテキストも提供されていません');
          const error = createErrorResponse(ErrorCodes.MISSING_REQUIRED_FIELD);
          return NextResponse.json(error, { status: getHttpStatus(ErrorCodes.MISSING_REQUIRED_FIELD) });
        }

        let urls: string[] = [];
        if (urlsJson) {
          try {
            urls = JSON.parse(urlsJson);
            if (!Array.isArray(urls)) {
              throw new Error('Invalid URLs format');
            }
            console.log('[DEBUG] パース済みURL:', urls);
          } catch (error) {
            console.error('[ERROR] URLのJSONパース失敗:', error);
            const errorResponse = createErrorResponse(ErrorCodes.INVALID_URL_FORMAT);
            return NextResponse.json(errorResponse, { status: getHttpStatus(ErrorCodes.INVALID_URL_FORMAT) });
          }
        }

        const extractedTexts: string[] = [];
        let urlResults: PromiseSettledResult<{ source: string; text: string }>[] = [];

        // 複数URLからテキスト抽出（並列処理）
        if (urls.length > 0) {
          console.log(`[DEBUG] ${urls.length}件のURL解析を開始`);
          urlResults = await Promise.allSettled(
            urls.map(async (url, index) => {
              try {
                console.log(`[DEBUG] URL ${index + 1}/${urls.length} 取得開始:`, url);
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
                  console.log(`[DEBUG] URL ${index + 1} 取得成功:`, {
                    status: response.status,
                    contentType: response.headers.get('content-type'),
                  });
                } catch (fetchError) {
                  console.error(`[ERROR] URL ${index + 1} fetch error:`, fetchError);
                  devLog.error(`URL ${index + 1} fetch error:`, fetchError);
                  throw new Error(
                    `URL_NOT_ACCESSIBLE:情報の取得に失敗しました。『会社概要』『IR情報』などのテキスト情報が多いページでもう一度お試しください。`
                  );
                }

                if (!response.ok) {
                  throw new Error(`URL_NOT_ACCESSIBLE:ページにアクセスできませんでした（HTTP ${response.status}）。『会社概要ページ』などの公開されているページを指定してください。`);
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

                console.log(`[DEBUG] URL ${index + 1} テキスト抽出完了:`, {
                  textLength: cleanedText.length,
                  preview: cleanedText.substring(0, 100),
                });

                if (cleanedText.length < 50) {
                  console.warn(`[WARN] URL ${index + 1} コンテンツが短すぎる (${cleanedText.length}文字)`);
                  throw new Error('CONTENT_NOT_FOUND:十分な情報が見つかりませんでした。トップページではなく『会社概要』『代表メッセージ』『IR情報』などのページを指定してください。');
                }

                return {
                  source: `URL ${index + 1}`,
                  text: cleanedText,
                };
              } catch (error) {
                devLog.warn(`URL ${index + 1} extraction failed:`, error);
                // エラータイプを判別してthrow
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('URL_NOT_ACCESSIBLE')) {
                  throw new Error(`URL_NOT_ACCESSIBLE:${url}`);
                } else if (errorMessage.includes('CONTENT_NOT_FOUND')) {
                  throw new Error(`CONTENT_NOT_FOUND:${url}`);
                } else {
                  throw new Error(`SCRAPING_FAILED:${url}`);
                }
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
          console.log('[DEBUG] PDFテキスト追加:', {
            originalLength: pdfText.length,
            cleanedLength: cleanedPdfText.length,
          });
        } else if (pdfText) {
          console.warn('[WARN] PDFテキストが短すぎるためスキップ:', pdfText.trim().length);
        }

        // すべてのソースが失敗した場合
        if (extractedTexts.length === 0) {
          // 失敗したURLのエラー詳細を収集
          const failedUrls = urlResults
            ?.filter((r) => r.status === 'rejected')
            .map((r: any) => {
              const reason = r.reason?.message || '';
              // エラーメッセージから詳細を抽出（ERROR_CODE:詳細メッセージ の形式）
              if (reason.includes(':')) {
                return reason.split(':').slice(1).join(':').trim();
              } else if (reason.includes('URL_NOT_ACCESSIBLE')) {
                return 'URLにアクセスできませんでした';
              } else if (reason.includes('CONTENT_NOT_FOUND')) {
                return '有効なコンテンツが見つかりませんでした';
              } else {
                return 'スクレイピングに失敗しました';
              }
            });

          const error = createErrorResponse(
            ErrorCodes.ALL_SOURCES_FAILED,
            undefined,
            undefined,
            { failedUrls }
          );
          return NextResponse.json(error, { status: getHttpStatus(ErrorCodes.ALL_SOURCES_FAILED) });
        }

        // テキストを結合（最大10,000文字）
        const combinedText = extractedTexts.join('\n\n').substring(0, 10000);

        console.log('[DEBUG] 結合テキスト準備完了:', {
          sourcesCount: extractedTexts.length,
          totalLength: combinedText.length,
        });

        // Gemini APIで情報を抽出
        // Gemini APIで情報を抽出
        console.log('[DEBUG] Gemini API呼び出し開始');
        const google = getGoogleProvider();
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

        console.log('[DEBUG] Gemini APIレスポンス受信:', {
          responseLength: responseText.length,
          preview: responseText.substring(0, 200),
        });

        // JSONを抽出
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('[ERROR] Gemini APIレスポンスからJSONを抽出できません:', responseText);
          const error = createErrorResponse(ErrorCodes.AI_RESPONSE_INVALID);
          return NextResponse.json(error, { status: getHttpStatus(ErrorCodes.AI_RESPONSE_INVALID) });
        }

        // JSON.parseを安全に実行
        let extractedData;
        try {
          extractedData = JSON.parse(jsonMatch[0]);
          console.log('[DEBUG] 抽出データ:', extractedData);
        } catch (parseError) {
          console.error('[ERROR] JSONパースエラー:', parseError);
          console.error('[ERROR] パース対象JSON:', jsonMatch[0]);
          devLog.error('JSON parse error:', parseError);
          const error = createErrorResponse(ErrorCodes.AI_RESPONSE_INVALID);
          return NextResponse.json(error, { status: getHttpStatus(ErrorCodes.AI_RESPONSE_INVALID) });
        }

        console.log('[DEBUG] PDF/URL解析完了:', {
          urlsProcessed: extractedTexts.filter(t => t.includes('URL')).length,
          pdfProcessed: extractedTexts.some(t => t.includes('PDF')),
        });

        return NextResponse.json({
          success: true,
          data: extractedData,
          sources: {
            urlsProcessed: extractedTexts.filter(t => t.includes('URL')).length,
            pdfProcessed: extractedTexts.some(t => t.includes('PDF')),
          },
        });
      } catch (error: any) {
        console.error('[ERROR] ソース解析エラー詳細:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          fullError: error,
        });
        devLog.error('ソース解析エラー:', error);
        const errorResponse = createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'ソース解析に失敗しました',
          undefined,
          { originalError: error instanceof Error ? error.message : String(error) }
        );
        return NextResponse.json(errorResponse, { status: getHttpStatus(ErrorCodes.INTERNAL_ERROR) });
      }
    },
    {
      requireAuth: false, // ゲストユーザーも利用可能
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10, // 外部アクセス系は厳しく制限
      },
    }
  );
}
