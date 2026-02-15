/**
 * /api/analyze-event-url
 *
 * イベントURLからイベント情報を自動抽出
 */

import { NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { generateJson, TEMPERATURE } from '@/lib/gemini';
import { safeFetch } from '@/lib/url-validator';
import { extractTextFromHtml } from '@/lib/urlAnalysis';
import { z } from 'zod';
import { devLog } from '@/lib/logger';

const RequestSchema = z.object({
  event_url: z.string().url(),
});

const EventInfoSchema = z.object({
  eventName: z.string().optional(),
  eventDateTime: z.string().optional(),
  eventLocation: z.string().optional(),
  eventSpeakers: z.string().optional(),
  eventDescription: z.string().optional(),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    RequestSchema,
    async (data) => {
      const { event_url } = data;

      try {
        // 1. URLからコンテンツを取得
        const response = await safeFetch(
          event_url,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
          },
          10000,  // 10秒タイムアウト
          5 * 1024 * 1024  // 5MB上限
        );

        if (!response.ok) {
          return NextResponse.json({
            success: false,
            error: 'URL_FETCH_FAILED',
            message: 'このURLから情報を取得できませんでした。手動で入力してください。',
          }, { status: 200 });  // エラーでも200で返してUXを維持
        }

        const html = await response.text();
        const pageText = extractTextFromHtml(html).substring(0, 8000);

        if (pageText.length < 100) {
          return NextResponse.json({
            success: false,
            error: 'CONTENT_TOO_SHORT',
            message: 'このURLから十分な情報を取得できませんでした。手動で入力してください。',
          }, { status: 200 });
        }

        // 2. AIでイベント情報を抽出
        const prompt = `以下のWebページテキストからイベント情報を抽出してください。

【Webページテキスト】
${pageText}

【抽出ルール】
- eventName: イベント・セミナー・ウェビナーの正式名称（見つからなければ空文字）
- eventDateTime: 開催日時（例: "2024年3月15日(金) 14:00-16:00"）（見つからなければ空文字）
- eventLocation: 開催場所（オンラインの場合は"オンライン"）（見つからなければ空文字）
- eventSpeakers: 登壇者名（複数の場合はカンマ区切り）（見つからなければ空文字）
- eventDescription: イベント概要（100文字以内）（見つからなければ空文字）

【重要】
- 見つからない項目は空文字を返す
- 推測せず、ページに明記されている情報のみ抽出
- 日本語で出力

【出力形式】
JSON形式のみ：
{
  "eventName": "",
  "eventDateTime": "",
  "eventLocation": "",
  "eventSpeakers": "",
  "eventDescription": ""
}`;

        const eventInfo = await generateJson({
          prompt,
          schema: EventInfoSchema,
          maxRetries: 1,
          temperature: TEMPERATURE.analysis,
        });

        // 少なくとも1つの情報が取得できたか確認
        const hasAnyInfo = Object.values(eventInfo).some(v => v && v.trim() !== '');

        if (!hasAnyInfo) {
          return NextResponse.json({
            success: false,
            error: 'NO_EVENT_INFO',
            message: 'このURLからイベント情報を抽出できませんでした。手動で入力してください。',
          }, { status: 200 });
        }

        return NextResponse.json({
          success: true,
          data: eventInfo,
        });

      } catch (error) {
        devLog.error('Event URL analysis error:', error);
        return NextResponse.json({
          success: false,
          error: 'ANALYSIS_FAILED',
          message: 'イベント情報の解析中にエラーが発生しました。手動で入力してください。',
        }, { status: 200 });
      }
    },
    {
      requireAuth: false,
      rateLimit: { windowMs: 60000, maxRequests: 30 },
    }
  );
}
