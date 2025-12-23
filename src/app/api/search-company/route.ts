import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { getErrorMessage } from '@/lib/errorUtils';

// Input schema
const SearchSchema = z.object({
    companyName: z.string().min(1).max(200),
});

export const maxDuration = 30;

export async function POST(request: Request) {
    return await apiGuard(
        request,
        SearchSchema,
        async (data) => {
            const { companyName } = data;
            const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
            const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

            // Note: We should probably log a warning if keys are missing, 
            // but for now let's assume they might be missing in dev and handle gracefully or error.
            if (!apiKey || !cx) {
                console.warn('Google Search API keys are missing');
                return NextResponse.json(
                    {
                        error: 'Search configuration is missing',
                        code: 'CONFIG_ERROR',
                        results: 'Google Search APIの設定がありません。'
                    },
                    { status: 500 }
                );
            }

            try {
                const query = `${companyName} 最新ニュース プレスリリース`;
                const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=3&lr=lang_ja`;

                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Google Search API failed with status ${res.status}`);
                }

                const json = await res.json();

                let resultText = '';
                if (json.items && json.items.length > 0) {
                    resultText = json.items.map((item: any) => {
                        return `・[${item.title}] ${item.snippet}`;
                    }).join('\n');
                } else {
                    resultText = '関連するニュースは見つかりませんでした。';
                }

                return NextResponse.json({ results: resultText });

            } catch (error: unknown) {
                console.error('Search API Error:', error);
                return NextResponse.json(
                    {
                        error: 'Failed to fetch search results',
                        code: 'SEARCH_ERROR',
                        details: getErrorMessage(error)
                    },
                    { status: 500 }
                );
            }
        }
    );
}
