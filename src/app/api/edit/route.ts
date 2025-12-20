import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
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

// 入力スキーマ定義（文字数制限を追加）
const EditSchema = z.object({
  content: z.string().min(1, 'コンテンツは必須です').max(10000, 'コンテンツは10000文字以内で入力してください'),
  editType: z.enum(['casual', 'emphasize', 'shorten', 'passionate', 'concise', 'businesslike', 'proofread']),
});

export async function POST(request: Request) {
  return await apiGuard(
    request,
    EditSchema,
    async (data, user) => {
      try {
        const { content, editType } = data;

        // プロンプトインジェクション対策
        const safeContent = sanitizeForPrompt(content, 10000);

        const google = getGoogleProvider();
        const model = google('gemini-2.0-flash-exp');

        const formatConstraints = `

【フォーマット制約】
- **重要**: Markdown記法を一切使用しないこと
  * 太字（**text**）、斜体（*text*）、見出し（#）などは禁止
  * プレーンテキストのみで出力すること
- URLはリンク記法 [Title](URL) を使わず、そのまま記述すること
- 箇条書きが必要な場合は、ハイフン（-）やアスタリスク（*）を使わず、全角中黒（・）または改行のみを使用すること
- 手紙として自然で読みやすいプレーンテキスト形式にすること`;

        let editPrompt = '';

        switch (editType) {
          case 'casual':
            editPrompt = `以下の営業手紙をよりカジュアルで親しみやすい表現に書き換えてください。
ただし、ビジネスマナーは保ち、失礼のない範囲で調整してください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${safeContent}
${formatConstraints}

【カジュアル版の手紙】`;
            break;

          case 'emphasize':
            editPrompt = `以下の営業手紙で、事例・実績の部分をより強調して書き換えてください。
具体的な数字や成果があれば目立つように配置し、説得力を高めてください。
元の手紙の構成や他の要素は維持してください。

【元の手紙】
${safeContent}
${formatConstraints}

【事例強調版の手紙】`;
            break;

          case 'shorten':
            editPrompt = `以下の営業手紙を、重要なポイントを残しつつ、より簡潔に（600〜800文字程度に）短縮してください。
5つの構成要素はすべて含めてください。

【元の手紙】
${safeContent}
${formatConstraints}

【短縮版の手紙】`;
            break;

          case 'passionate':
            editPrompt = `以下の営業手紙を、より情熱的で熱意が伝わる表現に書き換えてください。
ただし、過度に感情的になりすぎず、プロフェッショナルな印象は保ってください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${safeContent}
${formatConstraints}

【情熱的な手紙】`;
            break;

          case 'concise':
            editPrompt = `以下の営業手紙を、元の長さの約8割（元の文字数の80%程度）に簡潔化してください。
重要な情報を残しつつ、冗長な表現を削ってください。
5つの構成要素はすべて含めてください。

【元の手紙】
${safeContent}
${formatConstraints}

【簡潔版の手紙】`;
            break;

          case 'businesslike':
            editPrompt = `以下の営業手紙を、よりビジネスライクでフォーマルな表現に修正してください。
丁寧で格式のある言葉遣いを使い、プロフェッショナルな印象を強めてください。
元の手紙の構成や要素は維持してください。

【元の手紙】
${safeContent}
${formatConstraints}

【ビジネスライク版の手紙】`;
            break;

          case 'proofread':
            editPrompt = `以下の営業手紙の誤字脱字、文法ミス、不自然な表現をチェックし、修正してください。
また、より適切な語彙や表現があれば改善してください。
基本的な内容や構成は変更せず、品質の向上のみを行ってください。

【元の手紙】
${safeContent}
${formatConstraints}

【校正後の手紙】`;
            break;

          default:
            return NextResponse.json(
              { error: '無効な編集タイプです' },
              { status: 400 }
            );
        }

        const result = await generateText({
          model: model,
          prompt: editPrompt,
        });
        const editedLetter = result.text;

        return NextResponse.json({ editedLetter });
      } catch (error) {
        devLog.error('編集エラー:', error);
        return NextResponse.json(
          { error: '編集に失敗しました' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: {
        windowMs: 60000,
        maxRequests: 20,
      },
    }
  );
}
