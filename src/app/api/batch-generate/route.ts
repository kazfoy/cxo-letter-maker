import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';

// バッチ生成用のスキーマ
const BatchGenerateSchema = z.object({
    batchId: z.string().uuid(),
    rowData: z.object({
        companyName: z.string(),
        name: z.string(),
        position: z.string().optional(),
        purpose: z.string().optional(), // 目的・背景
        note: z.string().optional(), // 備考
    }),
    commonData: z.object({
        myCompanyName: z.string(),
        myName: z.string(),
        myServiceDescription: z.string(),
        // 共通のテンプレート要素
        problem: z.string().optional(),
        solution: z.string().optional(),
        caseStudy: z.string().optional(),
        offer: z.string().optional(),
    }),
});

export async function POST(request: Request) {
    return await apiGuard(
        request,
        BatchGenerateSchema,
        async (data, user) => {
            // 1. プランチェック (Proプランのみ)
            // 注: 開発中はチェックを緩めるか、自分のユーザーをProにする必要があります
            if (!user) {
                return NextResponse.json(
                    { error: 'ログインが必要です' },
                    { status: 401 }
                );
            }

            const supabase = await createClient();

            // ユーザーのプランを確認
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user.id)
                .single();

            // TODO: 本番運用時はここを有効化
            // if (profile?.plan !== 'pro') {
            //   return NextResponse.json(
            //     { error: '一括生成機能はProプラン限定です' },
            //     { status: 403 }
            //   );
            // }

            // 2. 生成ロジック
            const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("API Key not found");
            }

            const google = createGoogleGenerativeAI({ apiKey });
            const model = google('gemini-2.0-flash-exp'); // 高速モデルを使用

            const { rowData, commonData } = data;

            // プロンプト構築
            const prompt = `
あなたはプロのセールスライターです。以下の情報を元に、決裁者向けの魅力的な手紙を作成してください。

【差出人】
会社名: ${commonData.myCompanyName}
氏名: ${commonData.myName}
サービス: ${commonData.myServiceDescription}

【宛先】
会社名: ${rowData.companyName}
役職: ${rowData.position || '担当者様'}
氏名: ${rowData.name}
${rowData.purpose ? `目的・背景: ${rowData.purpose}` : ''}
${rowData.note ? `備考: ${rowData.note}` : ''}

【提案内容】
課題: ${commonData.problem || '（業界共通の課題）'}
解決策: ${commonData.solution || '（貴社サービスによる解決）'}
事例: ${commonData.caseStudy || '（他社事例）'}
オファー: ${commonData.offer || '情報交換の機会をいただきたい'}

【制約】
- 800文字程度
- 丁寧だが熱意のあるトーン
- Markdownは使用しない（プレーンテキスト）
- 宛名は「${rowData.companyName} ${rowData.position ? rowData.position + ' ' : ''}${rowData.name}様」で始める
- 末尾は「${commonData.myCompanyName}\n${commonData.myName}」で締める
`;

            try {
                const result = await generateText({
                    model,
                    prompt,
                });

                const generatedContent = result.text;

                // 3. データベースに保存
                const { data: savedLetter, error: saveError } = await supabase
                    .from('letters')
                    .insert({
                        user_id: user.id,
                        content: generatedContent,
                        inputs: { ...commonData, ...rowData }, // 入力情報を統合して保存
                        mode: 'sales', // 一括生成は現状セールスモードのみ
                        status: 'draft',
                        batch_id: data.batchId, // バッチIDを保存
                    })
                    .select()
                    .single();

                if (saveError) {
                    console.error('Save Error:', saveError);
                    throw new Error('Failed to save generated letter');
                }

                return NextResponse.json({
                    letter: savedLetter,
                    success: true
                });

            } catch (error: any) {
                console.error('Batch Generation Error:', error);
                return NextResponse.json(
                    { error: error.message || 'Generation failed' },
                    { status: 500 }
                );
            }
        },
        {
            requireAuth: true, // 必須
        }
    );
}
