import type { TopicTag } from '@/types/analysis';
import { TOPIC_TAG_KEYWORDS } from './constants';

export function assignTopicTags(content: string): TopicTag[] {
  const tags: TopicTag[] = [];
  const contentLower = content.toLowerCase();

  for (const [tag, keywords] of Object.entries(TOPIC_TAG_KEYWORDS) as [TopicTag, string[]][]) {
    if (tag === 'other') continue;
    if (keywords.some((kw) => contentLower.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) {
    tags.push('other');
  }
  return tags;
}

export function generateBridgeReason(
  content: string,
  topicTags: TopicTag[],
  proposalTheme?: string,
): string {
  const tagReasons: Partial<Record<TopicTag, string>> = {
    governance: '経営体制の強化に関連',
    compliance: 'コンプライアンス体制の整備に関連',
    supply_chain: 'サプライチェーン最適化に関連',
    finance_ops: '財務・経理業務の効率化に関連',
    digital_transformation: 'デジタル変革の推進に関連',
    sustainability: 'サステナビリティ経営に関連',
    global_expansion: 'グローバル展開の課題に関連',
    hr_organization: '組織・人材戦略に関連',
    risk_management: 'リスク管理体制の強化に関連',
    growth_strategy: '成長戦略の実現に関連',
  };

  if (proposalTheme) {
    return `「${content.substring(0, 30)}...」の取り組みは、${proposalTheme}に貢献可能`;
  }

  const primaryTag = topicTags[0];
  if (primaryTag && tagReasons[primaryTag]) {
    return tagReasons[primaryTag]!;
  }

  return '経営課題の解決に関連';
}

export function calculateBridgeConfidence(
  content: string,
  topicTags: TopicTag[],
  proposalTheme?: string,
): number {
  let confidence = 50;

  if (topicTags.length > 0 && topicTags[0] !== 'other') {
    confidence += 15;
  }
  if (topicTags.length >= 2) {
    confidence += 10;
  }

  if (proposalTheme) {
    const themeLower = proposalTheme.toLowerCase();
    const contentLower = content.toLowerCase();
    if (contentLower.includes(themeLower) || themeLower.includes(contentLower.substring(0, 20))) {
      confidence += 20;
    }
  }

  if (/[\d,]+[%％万億件社名]/.test(content)) {
    confidence += 10;
  }

  return Math.min(100, confidence);
}
