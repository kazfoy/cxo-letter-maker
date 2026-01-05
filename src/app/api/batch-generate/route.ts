import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { cleanAIResponse, cleanJSONResponse } from '@/lib/text-cleaner';
import { getErrorMessage } from '@/lib/errorUtils';
import { MAX_BATCH_SIZE_PER_REQUEST, getPlan } from '@/config/subscriptionPlans';
import { validateDailyBatchLimit } from '@/lib/dailyLimitChecker';

// Define schema for a single item in the batch
const BatchItemSchema = z.object({
    companyName: z.string(),
    name: z.string(), // 担当者名
    position: z.string().optional(),
    department: z.string().optional(), // 部署名
    background: z.string().optional(), // 目的・背景
    note: z.string().optional(), // 備考
    url: z.string().optional(), // WebサイトURL
    eventName: z.string().optional(), // イベント招待用
    proposal: z.string().optional(), // セールス提案用
    senderName: z.string().optional(),
    senderCompany: z.string().optional(),
    senderDepartment: z.string().optional(),
    senderPosition: z.string().optional(),
});

// Define schema for the request body (no max limit - we handle slicing server-side)
const BatchGenerateSchema = z.object({
    items: z.array(BatchItemSchema),

    myCompanyName: z.string().optional(),
    myDepartment: z.string().optional(),
    myName: z.string().optional(),
    myServiceDescription: z.string().optional(),
    myPosition: z.string().optional(), // Added
    output_format: z.enum(['letter', 'email']).default('letter'),
    mode: z.enum(['sales', 'event']).default('sales'),
    senderMode: z.enum(['default', 'direct', 'csv_priority']).default('default'), // Added
});

// Helper to get Google Provider
function getGoogleProvider() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
    return createGoogleGenerativeAI({ apiKey });
}

export const maxDuration = 300; // Allow 5 minutes for batch processing

export async function POST(request: Request) {
    return await apiGuard(
        request,
        BatchGenerateSchema,
        async (data, user) => {
            const { items, myCompanyName, myDepartment, myName, myServiceDescription, myPosition, output_format, mode: clientMode, senderMode } = data;


            // 日次制限チェック
            if (!user) {
                return NextResponse.json(
                    { error: '認証が必要です' },
                    { status: 401 }
                );
            }

            const limitCheck = await validateDailyBatchLimit(user.id, items.length);

            if (!limitCheck.allowed) {
                return NextResponse.json(
                    {
                        error: limitCheck.errorMessage,
                        usage: limitCheck.usage,
                    },
                    { status: 429 } // Too Many Requests
                );
            }

            // Slice items to remaining daily allowance (partial success behavior)
            const remainingAllowance = limitCheck.usage?.remaining || 0;
            const itemsToProcess = items.slice(0, remainingAllowance);
            const skippedCount = items.length - itemsToProcess.length;

            // Server-side supabase client for DB operations (using logged in user context)
            const supabase = await createClient();

            const batchId = crypto.randomUUID();
            const total = itemsToProcess.length;

            // Create a TransformStream for streaming the response
            const encoder = new TextEncoder();
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();

            (async () => {
                try {
                    const google = getGoogleProvider();
                    const userPlan = limitCheck.usage?.userPlan || 'free';
                    const planConfig = getPlan(userPlan);
                    const modelId = planConfig.modelId || 'gemini-1.5-flash';
                    const model = google(modelId); // Use model from config

                    let successCount = 0;
                    let failureCount = 0;

                    // Fetch profile once before the loop (Optimized)
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    for (let i = 0; i < total; i++) {
                        const item = itemsToProcess[i];


                        // Resolve Sender Info based on senderMode
                        let resolvedSenderCompany = '';
                        let resolvedSenderDepartment = '';
                        let resolvedSenderName = '';
                        let resolvedSenderService = '';
                        let resolvedSenderPosition = '';

                        if (senderMode === 'direct') {
                            resolvedSenderCompany = myCompanyName || '';
                            resolvedSenderDepartment = myDepartment || '';
                            resolvedSenderName = myName || '';
                            resolvedSenderService = myServiceDescription || '';
                            resolvedSenderPosition = myPosition || '';
                        } else if (senderMode === 'csv_priority') {
                            resolvedSenderCompany = item.senderCompany || (profile?.company_name) || '';
                            resolvedSenderDepartment = item.senderDepartment || (profile as any)?.department || '';
                            resolvedSenderName = item.senderName || (profile?.user_name) || '';
                            resolvedSenderService = myServiceDescription || (profile?.service_description) || ''; // Service description usually comes from profile or input, rarely CSV
                            resolvedSenderPosition = item.senderPosition || (profile as any)?.position || '';
                        } else {
                            // Default mode (Profile)
                            resolvedSenderCompany = (profile?.company_name) || '（未設定）';
                            resolvedSenderDepartment = (profile as any)?.department || '';
                            resolvedSenderName = (profile?.user_name) || '（未設定）';
                            resolvedSenderService = (profile?.service_description) || '（未設定）';
                            resolvedSenderPosition = (profile as any)?.position || '';
                        }

                        // Determine Prompt Mode based on client-specified mode
                        let role = "あなたは企業のCxOに向けた丁寧な手紙を書く秘書です。礼節を重んじ、相手の心に響く手紙を作成してください。";
                        let specificInstruction = `- 相手企業(${item.companyName})の課題を推測し、自社サービスがいかに役立つかを提案してください。`;

                        // Email vs Letter adjustments
                        if (output_format === 'email') {
                            role = "あなたは企業の決裁者に向けた効果的な営業メールを作成するプロです。件名は開封率を高め、本文は簡潔かつアクションにつながる内容にしてください。";
                        }

                        // Use client-specified mode for prompt generation
                        if (clientMode === 'event') {
                            // Case A: Event Invitation
                            const eventName = item.eventName || '（イベント名未設定）';
                            if (output_format === 'email') {
                                role = `あなたはプロのイベントコーディネーターです。「${eventName}」への参加を促す、魅力的な招待メールを作成してください。`;
                            } else {
                                role = `あなたはプロのイベントコーディネーターです。「${eventName}」への参加を促す、魅力的な招待状を作成してください。`;
                            }
                            specificInstruction = `
- イベントの内容や魅力を伝え、参加メリットを強調してください。
- 添付されている日時や場所などの詳細情報（備考欄）を必ず盛り込んでください。
`;
                        } else {
                            // Case B: Sales (default)
                            const proposal = item.proposal || '自社サービスのご提案';
                            if (output_format === 'email') {
                                role = `あなたは優秀な法人営業担当です。「${proposal}」に関する課題解決型の提案メールを作成してください。`;
                            } else {
                                role = `あなたは優秀な法人営業担当です。「${proposal}」に関する課題解決型の提案レターを作成してください。`;
                            }
                            specificInstruction = `
- 相手の役職（${item.position || '担当者'}）を考慮し、メリットを訴求してください。
- 課題解決の視点から、なぜこの提案が必要なのかを論理的に説明してください。
`;
                        }

                        // Construct Prompt
                        const prompt = `
${role}

以下の情報を基に、ターゲット企業への質の高い${output_format === 'email' ? 'メール' : '手紙'}を作成してください。

【差出人】
会社名: ${resolvedSenderCompany}
部署名: ${resolvedSenderDepartment || '（なし）'}
氏名: ${resolvedSenderName}
役職: ${resolvedSenderPosition || '（なし）'}
サービス概要: ${resolvedSenderService}

【宛先】
企業名: ${item.companyName}
役職: ${item.department ? item.department + ' ' : ''}${item.position || '担当者'}
氏名: ${item.name}
URL: ${item.url || '（なし）'}

【背景・コンテキスト】
${item.background || '（特になし）'}

【備考・メモ】
${item.note || '（特になし）'}
※URLが提供されている場合は、その企業のWebサイト情報を踏まえた内容にしてください（可能であれば）。

【作成指示】
${specificInstruction}
- output_formatが'email'の場合は、以下のJSON形式で出力してください:
  For Email: {"subject": "件名", "body": "本文"}
  (Subjectは30文字以内、Bodyはプレーンテキスト)
- output_formatが'letter'の場合は、プレーンテキストの手紙形式（800文字程度）で出力してください。

【重要】
- Markdownコードブロックは絶対に使用しないでください
- プレーンテキストのみで出力してください
- 装飾記号（アスタリスク、ハッシュ記号など）も使用しないでください
`;

                        try {
                            // Generate Text
                            const result = await generateText({
                                model,
                                prompt,
                            });
                            let generatedText = result.text.trim();

                            // Clean AI response to remove markdown code blocks
                            generatedText = cleanAIResponse(generatedText);

                            let contentToSave = generatedText;
                            let emailData = null;

                            if (output_format === 'email') {
                                try {
                                    // Clean JSON response
                                    const cleaned = cleanJSONResponse(generatedText);
                                    const parsed = JSON.parse(cleaned);
                                    emailData = parsed;
                                    contentToSave = `件名: ${parsed.subject}\n\n${parsed.body}`;
                                } catch (e) {
                                    // Fallback if JSON parsing fails
                                    contentToSave = generatedText;
                                }
                            }

                            // Save to Supabase (letters table)
                            if (user?.id) {
                                const { error: dbError } = await supabase
                                    .from('letters')
                                    .insert({
                                        user_id: user.id, // Explicitly set user_id
                                        content: contentToSave,
                                        email_content: emailData,
                                        target_company: item.companyName, // Fixed: use target_company instead of company_name
                                        target_name: item.name, // Fixed: add required target_name field
                                        batch_id: batchId,
                                        status: 'generated',
                                        mode: clientMode, // Use client-specified mode
                                        model_name: 'gemini-2.0-flash-exp',
                                        inputs: item // Store original inputs for reference
                                    });

                                if (dbError) {
                                    console.error('DB Insert Error:', dbError);
                                    failureCount++;
                                    const errorMsg = JSON.stringify({
                                        type: 'error',
                                        index: i,
                                        companyName: item.companyName,
                                        message: 'Failed to save to DB: ' + dbError.message
                                    }) + '\n';
                                    await writer.write(encoder.encode(errorMsg));
                                } else {
                                    successCount++;
                                    const successMsg = JSON.stringify({
                                        type: 'progress',
                                        index: i,
                                        total,
                                        status: 'completed',
                                        companyName: item.companyName,
                                        generatedContent: contentToSave.substring(0, 50) + '...'
                                    }) + '\n';
                                    await writer.write(encoder.encode(successMsg));
                                }
                            } else {
                                // Should not happen due to apiGuard
                                failureCount++;
                                const errorMsg = JSON.stringify({
                                    type: 'error',
                                    index: i,
                                    companyName: item.companyName,
                                    message: 'User authentication missing'
                                }) + '\n';
                                await writer.write(encoder.encode(errorMsg));
                            }

                        } catch (genError: any) {
                            console.error('Generation Error:', genError);
                            failureCount++;

                            // Save failed record to DB with error message
                            if (user?.id) {
                                try {
                                    await supabase
                                        .from('letters')
                                        .insert({
                                            user_id: user.id,
                                            content: '', // Empty content for failed generation
                                            target_company: item.companyName,
                                            target_name: item.name,
                                            batch_id: batchId,
                                            status: 'failed',
                                            mode: clientMode, // Use client-specified mode
                                            model_name: 'gemini-2.0-flash-exp',
                                            inputs: item,
                                            error_message: genError.message || 'Generation failed'
                                        });
                                } catch (dbSaveError) {
                                    console.error('Failed to save error record to DB:', dbSaveError);
                                }
                            }

                            const errorMsg = JSON.stringify({
                                type: 'error',
                                index: i,
                                companyName: item.companyName,
                                message: genError.message || 'Generation failed'
                            }) + '\n';
                            await writer.write(encoder.encode(errorMsg));
                        }
                    }

                    const completeMsg = JSON.stringify({
                        type: 'done',
                        batchId,
                        total,
                        successCount,
                        failureCount,
                        skippedCount,
                    }) + '\n';
                    await writer.write(encoder.encode(completeMsg));

                } catch (err: unknown) {
                    console.error('Batch Process Error:', err);
                    const fatalMsg = JSON.stringify({ type: 'fatal', message: getErrorMessage(err) }) + '\n';
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
        },
        {
            requireAuth: true, // 認証必須
            rateLimit: {
                windowMs: 60 * 60 * 1000, // 1時間
                maxRequests: 5 // バッチ生成は重いので制限
            }
        }
    );
}
