import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { NextResponse, after } from 'next/server';
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

// Define schema for the request body
const BatchGenerateSchema = z.object({
    items: z.array(BatchItemSchema),
    myCompanyName: z.string().optional(),
    myDepartment: z.string().optional(),
    myName: z.string().optional(),
    myServiceDescription: z.string().optional(),
    myPosition: z.string().optional(),
    output_format: z.enum(['letter', 'email']).default('letter'),
    mode: z.enum(['sales', 'event']).default('sales'),
    senderMode: z.enum(['default', 'direct', 'csv_priority']).default('default'),
});

// Helper to get Google Provider
function getGoogleProvider() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
    return createGoogleGenerativeAI({ apiKey });
}

export const maxDuration = 300; // Allow 5 minutes for background task

export async function POST(request: Request) {
    return await apiGuard(
        request,
        BatchGenerateSchema,
        async (data, user) => {
            const { items, myCompanyName, myDepartment, myName, myServiceDescription, myPosition, output_format, mode: clientMode, senderMode } = data;

            if (!user) {
                return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
            }

            const limitCheck = await validateDailyBatchLimit(user.id, items.length);
            if (!limitCheck.allowed) {
                return NextResponse.json(
                    { error: limitCheck.errorMessage, usage: limitCheck.usage },
                    { status: 429 }
                );
            }

            const remainingAllowance = limitCheck.usage?.remaining || 0;
            const itemsToProcess = items.slice(0, remainingAllowance);
            const total = itemsToProcess.length;
            const batchId = crypto.randomUUID();

            const supabase = await createClient();

            // 1. Insert batch job record
            await supabase.from('batch_jobs').insert({
                id: batchId,
                user_id: user.id,
                status: 'running',
                total_count: total,
                completed_count: 0,
                failed_count: 0
            });

            // 2. Start background generation
            // Instantiate provider here to fail fast if API key is missing
            const google = getGoogleProvider();

            after(async () => {
                try {
                    // const google = getGoogleProvider(); // Removed duplicate
                    const userPlan = limitCheck.usage?.userPlan || 'free';
                    const planConfig = getPlan(userPlan);
                    const modelId = planConfig.modelId || 'gemini-1.5-flash';
                    const model = google(modelId);

                    let successCount = 0;
                    let failureCount = 0;

                    // Fetch profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    for (let i = 0; i < total; i++) {
                        // Check for cancellation
                        const { data: jobStatus } = await supabase
                            .from('batch_jobs')
                            .select('status')
                            .eq('id', batchId)
                            .single();

                        if (jobStatus?.status === 'cancelled') break;

                        const item = itemsToProcess[i];

                        // Resolve Sender Info
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
                            resolvedSenderService = myServiceDescription || (profile?.service_description) || '';
                            resolvedSenderPosition = item.senderPosition || (profile as any)?.position || '';
                        } else {
                            resolvedSenderCompany = (profile?.company_name) || '（未設定）';
                            resolvedSenderDepartment = (profile as any)?.department || '';
                            resolvedSenderName = (profile?.user_name) || '（未設定）';
                            resolvedSenderService = (profile?.service_description) || '（未設定）';
                            resolvedSenderPosition = (profile as any)?.position || '';
                        }

                        // Prepare Prompt
                        let role = "あなたは企業のCxOに向けた丁寧な手紙を書く秘書です。礼節を重んじ、相手の心に響く手紙を作成してください。";
                        let specificInstruction = `- 相手企業(${item.companyName})の課題を推測し、自社サービスがいかに役立つかを提案してください。`;

                        if (output_format === 'email') {
                            role = "あなたは企業の決裁者に向けた効果的な営業メールを作成するプロです。件名は開封率を高め、本文は簡潔かつアクションにつながる内容にしてください。";
                        }

                        if (clientMode === 'event') {
                            const eventName = item.eventName || '（イベント名未設定）';
                            role = `あなたはプロのイベントコーディネーターです。「${eventName}」への参加を促す、魅力的な招待${output_format === 'email' ? 'メール' : '状'}を作成してください。`;
                            specificInstruction = `- イベントの内容や魅力を伝え、参加メリットを強調してください。\n- 添付されている詳細情報（備考欄）を盛り込んでください。`;
                        } else {
                            const proposal = item.proposal || '自社サービスのご提案';
                            role = `あなたは優秀な法人営業担当です。「${proposal}」に関する課題解決型の提案${output_format === 'email' ? 'メール' : 'レター'}を作成してください。`;
                            specificInstruction = `- 相手の役職（${item.position || '担当者'}）を考慮し、メリットを訴求してください。\n- 課題解決の視点から、論理的に説明してください。`;
                        }

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

【作成指示】
${specificInstruction}
- output_formatが'email'の場合は、以下のJSON形式で出力してください: {"subject": "件名", "body": "本文"}
- output_formatが'letter'の場合は、プレーンテキスト形式（800文字程度）で出力してください。

【重要】
- Markdownコードブロックや装飾記号は絶対に使用しないでください
- プレーンテキストのみで出力してください
`;

                        try {
                            const result = await generateText({ model, prompt });
                            let generatedText = cleanAIResponse(result.text.trim());
                            let contentToSave = generatedText;
                            let emailData = null;

                            if (output_format === 'email') {
                                try {
                                    const cleaned = cleanJSONResponse(generatedText);
                                    const parsed = JSON.parse(cleaned);
                                    emailData = parsed;
                                    contentToSave = `件名: ${parsed.subject}\n\n${parsed.body}`;
                                } catch (e) {
                                    contentToSave = generatedText;
                                }
                            }

                            const { error: dbError } = await supabase.from('letters').insert({
                                user_id: user.id,
                                content: contentToSave,
                                email_content: emailData,
                                target_company: item.companyName,
                                target_name: item.name,
                                batch_id: batchId,
                                status: 'generated',
                                mode: clientMode,
                                model_name: modelId,
                                inputs: item
                            });

                            if (dbError) {
                                throw dbError;
                            } else {
                                successCount++;
                                await supabase.rpc('increment_batch_job_count', { job_id: batchId, column_name: 'completed_count' });
                            }
                        } catch (err) {
                            console.error('Item Generation Error:', err);
                            failureCount++;
                            await supabase.rpc('increment_batch_job_count', { job_id: batchId, column_name: 'failed_count' });

                            // Save error record
                            try {
                                await supabase.from('letters').insert({
                                    user_id: user.id,
                                    content: '',
                                    target_company: item.companyName,
                                    target_name: item.name,
                                    batch_id: batchId,
                                    status: 'failed',
                                    mode: clientMode,
                                    model_name: modelId,
                                    inputs: item,
                                    error_message: getErrorMessage(err)
                                });
                            } catch (e) {
                                console.error('Failed to save error record:', e);
                            }
                        }
                    }

                    // Final Update
                    await supabase.from('batch_jobs').update({
                        status: 'completed',
                        completed_count: successCount,
                        failed_count: failureCount,
                        updated_at: new Date().toISOString()
                    }).eq('id', batchId);

                } catch (err) {
                    console.error('Fatal Background Error:', err);
                    try {
                        await supabase.from('batch_jobs').update({
                            status: 'failed',
                            error_message: getErrorMessage(err)
                        }).eq('id', batchId);
                    } catch (e) {
                        console.error('Failed to update fatal error:', e);
                    }
                }
            });

            return NextResponse.json({ batchId, total });
        },
        {
            requireAuth: true,
            rateLimit: {
                windowMs: 60 * 60 * 1000,
                maxRequests: 5
            }
        }
    );
}
