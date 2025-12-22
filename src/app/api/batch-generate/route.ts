import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define schema for a single item in the batch
const BatchItemSchema = z.object({
    companyName: z.string(),
    name: z.string(), // 担当者名
    position: z.string().optional(),
    background: z.string().optional(), // 目的・背景
    note: z.string().optional(), // 備考
    url: z.string().optional(), // WebサイトURL
    eventName: z.string().optional(), // イベント招待用
    proposal: z.string().optional(), // セールス提案用
});

// Define schema for the request body
const BatchGenerateSchema = z.object({
    items: z.array(BatchItemSchema).max(50, '一度に生成できるのは50件までです'), // Limit batch size
    myCompanyName: z.string().optional(),
    myName: z.string().optional(),
    myServiceDescription: z.string().optional(),
});

// Helper to get Google Provider
function getGoogleProvider() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
    return createGoogleGenerativeAI({ apiKey });
}

export const maxDuration = 300; // Allow 5 minutes for batch processing

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const parseResult = BatchGenerateSchema.safeParse(json);

        if (!parseResult.success) {
            return NextResponse.json({ error: 'Invalid input', details: parseResult.error }, { status: 400 });
        }

        const { items, myCompanyName, myName, myServiceDescription } = parseResult.data;
        const batchId = crypto.randomUUID();
        const total = items.length;

        // Create a TransformStream for streaming the response
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        (async () => {
            try {
                const google = getGoogleProvider();
                const model = google('gemini-2.0-flash-exp'); // Use fast model for batch

                for (let i = 0; i < total; i++) {
                    const item = items[i];

                    // Determine Prompt Mode
                    let role = "あなたは企業のCxOに向けた丁寧な手紙を書く秘書です。礼節を重んじ、相手の心に響く手紙を作成してください。";
                    let specificInstruction = "- 相手企業(${item.companyName})の課題を推測し、自社サービスがいかに役立つかを提案してください。";

                    if (item.eventName) {
                        // Case A: Event Invitation
                        role = `あなたはプロのイベントコーディネーターです。「${item.eventName}」への参加を促す、魅力的な招待状を作成してください。`;
                        specificInstruction = `
- イベントの内容や魅力を伝え、参加メリットを強調してください。
- 添付されている日時や場所などの詳細情報（備考欄）を必ず盛り込んでください。
`;
                    } else if (item.proposal) {
                        // Case B: Sales Proposal
                        role = `あなたは優秀な法人営業担当です。「${item.proposal}」に関する課題解決型の提案レターを作成してください。`;
                        specificInstruction = `
- 相手の役職（${item.position || '担当者'}）を考慮し、メリットを訴求してください。
- 課題解決の視点から、なぜこの提案が必要なのかを論理的に説明してください。
`;
                    }

                    // Construct Prompt
                    const prompt = `
${role}

以下の情報を基に、ターゲット企業への質の高い手紙を作成してください。

【差出人】
会社名: ${myCompanyName || '（未設定）'}
氏名: ${myName || '（未設定）'}
サービス概要: ${myServiceDescription || '（未設定）'}

【宛先】
企業名: ${item.companyName}
氏名: ${item.name}
役職: ${item.position || '担当者'}
URL: ${item.url || '（なし）'}

【背景・コンテキスト】
${item.background || '（特になし）'}

【備考・メモ】
${item.note || '（特になし）'}
※URLが提供されている場合は、その企業のWebサイト情報を踏まえた内容にしてください（可能であれば）。

【作成指示】
${specificInstruction}
- 丁寧かつ簡潔に（800文字程度）。
- Markdownは使用せず、プレーンテキストで出力してください。
`;

                    try {
                        // Generate Text
                        const result = await generateText({
                            model,
                            prompt,
                        });
                        const letterContent = result.text;

                        // Save to Supabase (letters table)
                        // Using 'content' as the main body.
                        const { error: dbError } = await supabase
                            .from('letters')
                            .insert({
                                content: letterContent,
                                company_name: item.companyName,
                                // industry: 'Batch Generated', // Removed if column doesn't exist, rely on defaults
                                batch_id: batchId,
                            });

                        if (dbError) {
                            console.error('DB Insert Error:', dbError);
                            const errorMsg = JSON.stringify({
                                type: 'error',
                                index: i,
                                message: 'Failed to save to DB: ' + dbError.message
                            }) + '\n';
                            await writer.write(encoder.encode(errorMsg));
                        } else {
                            const successMsg = JSON.stringify({
                                type: 'progress',
                                index: i,
                                total,
                                status: 'completed',
                                generatedContent: letterContent.substring(0, 50) + '...'
                            }) + '\n';
                            await writer.write(encoder.encode(successMsg));
                        }

                    } catch (genError: any) {
                        console.error('Generation Error:', genError);
                        const errorMsg = JSON.stringify({
                            type: 'error',
                            index: i,
                            message: genError.message || 'Generation failed'
                        }) + '\n';
                        await writer.write(encoder.encode(errorMsg));
                    }
                }

                const completeMsg = JSON.stringify({ type: 'done', batchId, total }) + '\n';
                await writer.write(encoder.encode(completeMsg));

            } catch (err: any) {
                console.error('Batch Process Error:', err);
                const fatalMsg = JSON.stringify({ type: 'fatal', message: err.message }) + '\n';
                await writer.write(encoder.encode(fatalMsg));
            } finally {
                await writer.close();
            }
        })();

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
