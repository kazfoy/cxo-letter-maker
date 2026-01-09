import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { getErrorMessage } from '@/lib/errorUtils';
import { searchNewsFacts } from '@/lib/news-search';

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

            try {
                const resultText = await searchNewsFacts(companyName);
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
        },
        { requireAuth: false }
    );
}
