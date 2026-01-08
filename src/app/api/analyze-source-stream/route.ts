import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as cheerio from 'cheerio';
import { safeFetch } from '@/lib/url-validator';
import { devLog } from '@/lib/logger';
import type { LetterStructure, Industry, SSEEvent } from '@/types/letter';

export const maxDuration = 60;

let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

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

// SSEイベント送信ヘルパー
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: SSEEvent
) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

// 情報不足判定関数
function needsSupplementalInfo(extractedTexts: string[]): boolean {
  const totalLength = extractedTexts.join('').length;
  return totalLength < 500;
}

// Google検索フォールバック関数
async function searchCompanyForFallback(companyName: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    console.warn('[WARN] Google Search API keys not configured');
    return null;
  }

  try {
    const query = `${companyName} 会社概要 事業内容`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&lr=lang_ja`;

    const response = await fetch(url);
    const json = await response.json();

    if (json.items && json.items.length > 0) {
      const snippets = json.items
        .map((item: { title?: string; snippet?: string }) => `${item.title || ''}: ${item.snippet || ''}`)
        .join('\n');
      console.log('[DEBUG] Google検索フォールバック成功:', snippets.substring(0, 200));
      return snippets;
    }
    return null;
  } catch (error) {
    console.error('[ERROR] Google検索フォールバック失敗:', error);
    return null;
  }
}

// 業界推定関数
function detectIndustry(companyName: string, snippets?: string): Industry {
  const text = `${companyName} ${snippets || ''}`;

  if (/システム|IT|ソフト|デジタル|テック|DX|クラウド|SaaS|アプリ|ウェブ|Web/i.test(text)) return 'it';
  if (/製造|工場|メーカー|生産|部品|機械|電機/i.test(text)) return 'manufacturing';
  if (/金融|銀行|保険|証券|投資|ファイナンス/i.test(text)) return 'finance';
  if (/小売|販売|店舗|EC|通販|ショップ|リテール/i.test(text)) return 'retail';
  if (/サービス|コンサル|人材|教育|研修|支援/i.test(text)) return 'service';
  return 'generic';
}

// 業界別テンプレート
const industryTemplates: Record<Industry, LetterStructure> = {
  it: {
    background: "DX推進や業務効率化の取り組みを拝見し、ご連絡いたしました。",
    problem: "急速なデジタル化の中、システムの刷新や運用コスト削減は多くの企業様の課題かと存じます。",
    solution: "弊社では、こうした課題に対してクラウド活用・自動化のアプローチで支援しております。",
    caseStudy: "具体的には、まず現状のシステム構成をヒアリングし、最適化プランをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  },
  manufacturing: {
    background: "製造業界でのご活躍を拝見し、お力になれればと考えご連絡いたしました。",
    problem: "生産性向上やサプライチェーンの最適化、品質管理の高度化は業界共通の課題かと存じます。",
    solution: "弊社では、製造現場のデータ活用・見える化で多くの企業様を支援しております。",
    caseStudy: "まずは現場の課題をヒアリングし、具体的な改善プランをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  },
  service: {
    background: "サービス品質向上への取り組みを拝見し、ご連絡いたしました。",
    problem: "人材不足や顧客満足度の維持・向上は、サービス業界共通の課題かと存じます。",
    solution: "弊社では、業務効率化と顧客体験向上の両立を支援しております。",
    caseStudy: "まずは現状の業務フローをヒアリングし、改善ポイントをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  },
  finance: {
    background: "金融業界でのイノベーションへの取り組みを拝見し、ご連絡いたしました。",
    problem: "規制対応とデジタル化の両立、顧客接点の強化は業界共通の課題かと存じます。",
    solution: "弊社では、コンプライアンスを維持しながらDXを推進する支援を行っております。",
    caseStudy: "まずは現状の課題をヒアリングし、段階的な改善プランをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  },
  retail: {
    background: "小売業界での新たな取り組みを拝見し、ご連絡いたしました。",
    problem: "オンライン・オフライン融合や在庫最適化、顧客データ活用は業界共通の課題かと存じます。",
    solution: "弊社では、データドリブンな小売戦略の構築を支援しております。",
    caseStudy: "まずは現状の販売データを分析し、改善ポイントをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  },
  generic: {
    background: "御社のご発展を拝見し、お力になれればと考えご連絡いたしました。",
    problem: "業界全体で効率化や競争力強化が求められる中、様々な課題をお持ちかと存じます。",
    solution: "弊社では、こうした課題に対して最適なソリューションを提案しております。",
    caseStudy: "具体的には、まず現状をヒアリングし、御社に合ったプランをご提案いたします。",
    offer: "一度、詳細をご説明するお時間をいただけないでしょうか。"
  }
};

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // FormDataを解析
        const formData = await request.formData();
        const urlsJson = formData.get('urls') as string;
        const pdfText = formData.get('pdfText') as string | null;
        const isEventUrl = formData.get('isEventUrl') === 'true';
        const sourceInputType = formData.get('sourceInputType') as 'own' | 'target' | null;
        const inputCompanyName = formData.get('companyName') as string | null;

        if (!urlsJson && !pdfText) {
          sendEvent(controller, encoder, {
            phase: 'complete',
            error: 'URLまたはPDFファイルを入力してください'
          });
          controller.close();
          return;
        }

        let urls: string[] = [];
        if (urlsJson) {
          try {
            urls = JSON.parse(urlsJson);
            if (!Array.isArray(urls)) {
              throw new Error('Invalid URLs format');
            }
          } catch {
            sendEvent(controller, encoder, {
              phase: 'complete',
              error: 'URLの形式が無効です'
            });
            controller.close();
            return;
          }
        }

        // フェーズ1: サイトアクセス
        sendEvent(controller, encoder, {
          phase: 'connecting',
          message: 'サイトにアクセス中...'
        });

        const extractedTexts: string[] = [];
        let detectedCompanyName: string | null = null;

        // 複数URLからテキスト抽出（並列処理）
        if (urls.length > 0) {
          console.log(`[DEBUG] ${urls.length}件のURL解析を開始`);
          const urlResults = await Promise.allSettled(
            urls.map(async (url, index) => {
              try {
                let response: Response;
                try {
                  response = await safeFetch(
                    url,
                    {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      },
                    },
                    10000,
                    5 * 1024 * 1024
                  );
                } catch (fetchError) {
                  devLog.error(`URL ${index + 1} fetch error:`, fetchError);
                  throw new Error(`URL_NOT_ACCESSIBLE:${url}`);
                }

                if (!response.ok) {
                  throw new Error(`URL_NOT_ACCESSIBLE:HTTP ${response.status}`);
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
                  throw new Error('CONTENT_NOT_FOUND');
                }

                return {
                  source: `URL ${index + 1}`,
                  text: cleanedText,
                };
              } catch (error) {
                devLog.warn(`URL ${index + 1} extraction failed:`, error);
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

        // PDFテキストを追加
        if (pdfText && pdfText.trim().length >= 50) {
          const cleanedPdfText = pdfText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000);
          extractedTexts.push(`=== PDF Document ===\n${cleanedPdfText}`);
        }

        // フェーズ2: 情報抽出
        sendEvent(controller, encoder, {
          phase: 'extracting',
          message: '情報を抽出中...'
        });

        // 情報不足時またはすべて失敗時のフォールバック
        let fallbackSnippets: string | null = null;
        const companyNameForSearch = inputCompanyName || detectedCompanyName;

        if (needsSupplementalInfo(extractedTexts) && companyNameForSearch) {
          sendEvent(controller, encoder, {
            phase: 'searching',
            message: 'Web検索で情報を補完中...'
          });

          fallbackSnippets = await searchCompanyForFallback(companyNameForSearch);

          if (fallbackSnippets) {
            extractedTexts.push(`=== Web検索結果 ===\n${fallbackSnippets}`);
          }
        }

        // すべてのソースが失敗し、フォールバックも失敗した場合は業界別テンプレート
        if (extractedTexts.length === 0) {
          console.log('[INFO] 情報取得失敗、業界別テンプレートを使用');
          const industry = detectIndustry(companyNameForSearch || '', fallbackSnippets || '');
          const template = industryTemplates[industry];

          sendEvent(controller, encoder, {
            phase: 'complete',
            data: {
              companyName: companyNameForSearch || '',
              letterStructure: template,
            }
          });
          controller.close();
          return;
        }

        // フェーズ3: 構成案生成
        sendEvent(controller, encoder, {
          phase: 'generating',
          message: '構成案を作成中...'
        });

        // テキストを結合（最大10,000文字）
        const combinedText = extractedTexts.join('\n\n').substring(0, 10000);

        // Gemini APIで情報を抽出
        const google = getGoogleProvider();
        const model = google('gemini-2.0-flash');

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
        } else if (sourceInputType === 'own') {
          // 自社情報抽出 + 構成案生成プロンプト（caseStudy追加）
          extractPrompt = `あなたはセールスライティングの専門家です。以下のソース（WebページとPDF）から自社の情報を抽出し、さらにそのサービスを活用したセールスレターの汎用的な構成案を生成してJSON形式で返してください。

【ソーステキスト】
${combinedText}

【抽出・生成する情報】
1. 基本情報:
- companyName: 会社名
- summary: 事業概要・提供サービスの内容（150-300文字程度、具体的に）

2. レター構成案（letterStructure）:
自社の強みを活かした、汎用的なセールスレターの構成案を生成してください。
- background: ターゲットが抱えがちな課題・背景（100-150文字）
  * 自社サービスが解決できる「一般的な課題」を提示
- problem: 具体的な課題の深掘り（100-150文字）
  * 自社サービスを導入しないことによるデメリットや、現場の痛み
- solution: 自社ソリューションの提示（100-150文字）
  * 「弊社の〇〇というサービスは」という形式で、自社の強みをアピール
- caseStudy: 提案の具体的なアプローチ・事例（100-150文字）
  * 「具体的には」という形式で、どのように進めるかを説明
  * 導入ステップや、類似事例があれば言及
- offer: 結び・ネクストアクション（80-120文字）
  * 「一度詳細をご説明するお時間をいただけないでしょうか」といった標準的なオファー

【出力形式】
JSON形式で返してください（説明文は不要）：
{
  "companyName": "会社名",
  "summary": "事業概要・サービス内容",
  "letterStructure": {
    "background": "想定されるターゲットの課題",
    "problem": "課題の深掘り",
    "solution": "自社サービスの強み",
    "caseStudy": "提案の具体的なアプローチ",
    "offer": "結び・オファー"
  }
}

※ JSONのみを返してください。説明文は不要です。`;
        } else {
          // ターゲット企業情報抽出 + 構成案生成プロンプト（caseStudy追加）
          extractPrompt = `あなたは企業分析とセールスレター構成の専門家です。以下のソース（WebページとPDF）からターゲット企業の情報を抽出し、さらにその企業へのセールスレター構成案を生成してJSON形式で返してください。

【ソーステキスト】
${combinedText}

【抽出する情報】
1. 基本情報:
- companyName: 会社名（複数ソースで一致する名前を優先、見つからない場合は空文字）
- personName: 氏名（代表者や担当者、見つかった場合のみ、見つからない場合は空文字）
- personPosition: 役職（personNameが見つかった場合、その人の役職も抽出する。見つからない場合は空文字）
- summary: 事業概要の統合サマリー（100-200文字程度）
- context: 手紙のフックになりそうな話題（ニュース、課題感、新規事業など、最新情報を優先、50-100文字程度）

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
  * 具体的な自社サービスの内容は不明なため、「〜という方向性での解決」を提示
- caseStudy: 提案の具体的なアプローチ（100-150文字）
  * 「具体的には」という形式で、どのように進めるかを提案
  * 初回ヒアリング、現状分析、段階的導入などのステップを示す
- offer: 結び・ネクストアクション（80-120文字）
  * 面談依頼や情報提供のオファー
  * 「ぜひ一度、〇〇についてお話しさせていただければ幸いです」のような形式

【重要な指示】
- 情報が不足している場合でもエラーにせず、会社名や業界から推測される一般的な課題・提案を仮説として生成してください
- letterStructure の各項目は必ず生成してください（空文字は不可）
- 推測で生成した場合は「〜と推察いたします」「〜ではないでしょうか」のような表現を使用してください

【出力形式】
JSON形式で返してください（説明文は不要）：
{
  "companyName": "会社名",
  "personName": "氏名",
  "personPosition": "役職",
  "summary": "統合サマリー",
  "context": "フックになる話題",
  "letterStructure": {
    "background": "相手企業の課題・背景",
    "problem": "具体的な課題の深掘り",
    "solution": "自社ソリューションとの接点",
    "caseStudy": "提案の具体的なアプローチ",
    "offer": "結び・ネクストアクション"
  }
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
          // JSON抽出失敗時も業界別テンプレートで対応
          const industry = detectIndustry(companyNameForSearch || '', combinedText);
          const template = industryTemplates[industry];

          sendEvent(controller, encoder, {
            phase: 'complete',
            data: {
              companyName: companyNameForSearch || '',
              letterStructure: template,
            }
          });
          controller.close();
          return;
        }

        let extractedData;
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch {
          // JSONパース失敗時も業界別テンプレートで対応
          const industry = detectIndustry(companyNameForSearch || '', combinedText);
          const template = industryTemplates[industry];

          sendEvent(controller, encoder, {
            phase: 'complete',
            data: {
              companyName: companyNameForSearch || '',
              letterStructure: template,
            }
          });
          controller.close();
          return;
        }

        // 完了イベント送信
        sendEvent(controller, encoder, {
          phase: 'complete',
          data: extractedData,
        });
        controller.close();

      } catch (error) {
        console.error('[ERROR] SSE解析エラー:', error);
        sendEvent(controller, encoder, {
          phase: 'complete',
          error: 'ソース解析に失敗しました。もう一度お試しください。',
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
