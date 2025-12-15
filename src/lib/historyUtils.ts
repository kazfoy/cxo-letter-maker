import { v4 as uuidv4 } from 'uuid';

export interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
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
  content: string
): void {
  try {
    const history: LetterHistory = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      targetCompany: inputs.companyName,
      targetName: inputs.name,
      content,
      inputs,
    };

    const stored = localStorage.getItem('letterHistories');
    const histories: LetterHistory[] = stored ? JSON.parse(stored) : [];

    // 新しい履歴を先頭に追加
    histories.unshift(history);

    // 最大10件まで保存
    const trimmed = histories.slice(0, 10);

    localStorage.setItem('letterHistories', JSON.stringify(trimmed));
  } catch (error) {
    console.error('履歴保存エラー:', error);
  }
}
