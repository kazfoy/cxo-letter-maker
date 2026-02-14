import { v4 as uuidv4 } from 'uuid';
import { devLog } from '@/lib/logger';

export interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
  isPinned?: boolean; // ピン留め状態
  mode?: 'sales' | 'event'; // セールスレターまたはイベント招待
  inputs: {
    myCompanyName: string;
    myName: string;
    myServiceDescription: string;
    companyName: string;
    position: string;
    name: string;
    background: string;
    problem: string;
    solution: string;
    caseStudy: string;
    offer: string;
    freeformInput?: string;
  };
}

export function saveToHistory(
  inputs: LetterHistory['inputs'],
  content: string,
  mode?: 'sales' | 'event'
): void {
  try {
    const history: LetterHistory = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      targetCompany: inputs.companyName,
      targetName: inputs.name,
      content,
      inputs,
      isPinned: false,
      mode: mode || 'sales', // デフォルトはsales
    };

    const stored = localStorage.getItem('letterHistories');
    const histories: LetterHistory[] = stored ? JSON.parse(stored) : [];

    // 新しい履歴を先頭に追加
    histories.unshift(history);

    // ピン留めされたアイテムとされていないアイテムを分離
    const pinnedItems = histories.filter(h => h.isPinned);
    const unpinnedItems = histories.filter(h => !h.isPinned);

    // ピン留めされていないアイテムのみを最大10件に制限
    const trimmedUnpinned = unpinnedItems.slice(0, 10);

    // ピン留めされたアイテムと結合（ピン留めされたアイテムは上限に含めない）
    const trimmed = [...pinnedItems, ...trimmedUnpinned];

    localStorage.setItem('letterHistories', JSON.stringify(trimmed));
  } catch (error) {
    devLog.error('履歴保存エラー:', error);
  }
}

/**
 * 指定IDの履歴のピン留め状態を切り替える
 */
export function togglePin(id: string): LetterHistory[] {
  try {
    const stored = localStorage.getItem('letterHistories');
    const histories: LetterHistory[] = stored ? JSON.parse(stored) : [];

    const updated = histories.map(h =>
      h.id === id ? { ...h, isPinned: !h.isPinned } : h
    );

    localStorage.setItem('letterHistories', JSON.stringify(updated));
    return updated;
  } catch (error) {
    devLog.error('ピン留め切り替えエラー:', error);
    return [];
  }
}
