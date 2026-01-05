import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';

import { getPlan } from '@/config/subscriptionPlans';


const ProcessItemSchema = z.object({
    batchId: z.string().uuid(),
    item: z.object({
        companyName: z.string(),
        name: z.string(),
        position: z.string().optional(),
        department: z.string().optional(),
        background: z.string().optional(),
        note: z.string().optional(),
        url: z.string().optional(),
        eventName: z.string().optional(),
        proposal: z.string().optional(),
        // Sender info overrides
        senderName: z.string().optional(),
        senderCompany: z.string().optional(),
        senderDepartment: z.string().optional(),
        senderPosition: z.string().optional()
    }),
    config: z.object({
        output_format: z.enum(['letter', 'email']),
        mode: z.enum(['sales', 'event']),
        senderMode: z.enum(['default', 'direct', 'csv_priority']),
        // Default sender info (fallback)
        myCompanyName: z.string().optional(),
        myDepartment: z.string().optional(),
        myName: z.string().optional(),
        myPosition: z.string().optional(),
        myServiceDescription: z.string().optional()
    })
});

// Helper to clean AI response
function cleanAIResponse(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function cleanJSONResponse(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}


export async function POST(request: Request) {
    return await apiGuard(
        request,
        ProcessItemSchema,
        async (data, user) => {
            if (!user) {
                return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
            }

            const { batchId, item, config } = data;
            const supabase = await createClient();

            // 1. Validation
            if (!item.companyName || !item.name) {
                // Increment failed count without RPC
                const { data: job } = await supabase.from('batch_jobs').select('processed_count, failure_count').eq('id', batchId).single();
                if (job) {
                    await supabase.from('batch_jobs').update({
                        processed_count: (job.processed_count || 0) + 1,
                        failure_count: (job.failure_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', batchId);
                }
                // Save failed record
                await supabase.from('letters').insert({
                    user_id: user.id,
                    content: '',
                    target_company: item.companyName || '（不明）',
                    target_name: item.name || '（不明）',
                    batch_id: batchId,
                    status: 'failed',
                    mode: config.mode,
                    inputs: item,
                    error_message: '必須項目（会社名または氏名）が不足しています'
                });
                return NextResponse.json({ success: false, error: 'Missing required fields' });
            }

            // 2. Resolve Sender Info
            // Fetch profile for fallbacks
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            let resolvedSenderCompany = '';
            let resolvedSenderDepartment = '';
            let resolvedSenderName = '';
            let resolvedSenderService = '';
            let resolvedSenderPosition = '';

            const { senderMode, myCompanyName, myDepartment, myName, myPosition, myServiceDescription } = config;

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

            // 3. Prepare AI Prompt
            let role = "あなたは企業のCxOに向けた丁寧な手紙を書く秘書です。礼節を重んじ、相手の心に響く手紙を作成してください。";
            let specificInstruction = `- 相手企業(${item.companyName})の課題を推測し、自社サービスがいかに役立つかを提案してください。`;

            if (config.output_format === 'email') {
                role = "あなたは企業の決裁者に向けた効果的な営業メールを作成するプロです。件名は開封率を高め、本文は簡潔かつアクションにつながる内容にしてください。";
            }

            if (config.mode === 'event') {
                const eventName = item.eventName || '（イベント名未設定）';
                role = `あなたはプロのイベントコーディネーターです。「${eventName}」への参加を促す、魅力的な招待${config.output_format === 'email' ? 'メール' : '状'}を作成してください。`;
                specificInstruction = `- イベントの内容や魅力を伝え、参加メリットを強調してください。\n- 添付されている詳細情報（備考欄）を盛り込んでください。`;
            } else {
                const proposal = item.proposal || '自社サービスのご提案';
                role = `あなたは優秀な法人営業担当です。「${proposal}」に関する課題解決型の提案${config.output_format === 'email' ? 'メール' : 'レター'}を作成してください。`;
                specificInstruction = `- 相手の役職（${item.position || '担当者'}）を考慮し、メリットを訴求してください。\n- 課題解決の視点から、論理的に説明してください。`;
            }

            const prompt = `
${role}

以下の情報を基に、ターゲット企業への質の高い${config.output_format === 'email' ? 'メール' : '手紙'}を作成してください。

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

            // 4. Generate
            try {
                const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
                if (!apiKey) throw new Error("API Key missing");

                const google = createGoogleGenerativeAI({ apiKey });
                // Determine model based on plan (simplified here, assuming standard for batch)
                // NOTE: Ideal to check plan limit here too, but client loop makes it hard to fetch plan every time.
                // We will rely on frontend pre-check or occasional failures?
                // For robustness, let's just use flash.
                const modelId = 'gemini-1.5-flash';
                const model = google(modelId);

                const result = await generateText({ model, prompt });
                let generatedText = cleanAIResponse(result.text.trim());
                let contentToSave = generatedText;
                let emailData = null;

                if (config.output_format === 'email') {
                    try {
                        const cleaned = cleanJSONResponse(generatedText);
                        const parsed = JSON.parse(cleaned);
                        emailData = parsed;
                        contentToSave = `件名: ${parsed.subject}\n\n${parsed.body}`;
                    } catch (e) {
                        contentToSave = generatedText;
                    }
                }

                // 5. Save to DB
                const { error: dbError } = await supabase.from('letters').insert({
                    user_id: user.id,
                    content: contentToSave,
                    email_content: emailData,
                    target_company: item.companyName,
                    target_name: item.name,
                    recipient_department: item.department || null,
                    sender_department: resolvedSenderDepartment || null,
                    batch_id: batchId,
                    status: 'generated',
                    mode: config.mode,
                    model_name: modelId,
                    inputs: item
                });

                if (dbError) throw dbError;

                // 6. Update Batch Counter
                // 6. Update Batch Counter (No RPC)
                const { data: job } = await supabase.from('batch_jobs').select('processed_count, success_count').eq('id', batchId).single();
                if (job) {
                    await supabase.from('batch_jobs').update({
                        processed_count: (job.processed_count || 0) + 1,
                        success_count: (job.success_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', batchId);
                }

                return NextResponse.json({ success: true });

            } catch (error) {
                console.error('Generation Error:', error);
                // Increment failed count without RPC
                const { data: job } = await supabase.from('batch_jobs').select('processed_count, failure_count').eq('id', batchId).single();
                if (job) {
                    await supabase.from('batch_jobs').update({
                        processed_count: (job.processed_count || 0) + 1,
                        failure_count: (job.failure_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', batchId);
                }

                // Save error record
                await supabase.from('letters').insert({
                    user_id: user.id,
                    content: '',
                    target_company: item.companyName,
                    target_name: item.name,
                    batch_id: batchId,
                    status: 'failed',
                    mode: config.mode,
                    inputs: item,
                    error_message: error instanceof Error ? error.message : '生成中にエラーが発生しました'
                });

                return NextResponse.json({ success: false, error: 'Generation failed' });
            }
        },
        { requireAuth: true }
    );
}
