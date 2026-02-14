import type { LetterHistory, LetterMode } from "@/types/letter";

const STORAGE_KEY = 'cxo_guest_history';
const MAX_ITEMS = 3;

// Helper to generate a random ID
function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getGuestHistory(): LetterHistory[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        // Parse and ensure dates are legitimate strings (or Date objects if reviver used, but usually strings)
        // We assume they are stored as ISO strings.
        const parsed: LetterHistory[] = JSON.parse(stored);

        // Validate structure roughly just in case
        if (!Array.isArray(parsed)) return [];

        return parsed;
    } catch (e) {
        console.error('Failed to parse guest history', e);
        return [];
    }
}

export function saveToGuestHistory(
    inputs: LetterHistory['inputs'],
    content: string,
    mode: LetterMode = 'sales'
): LetterHistory {
    const histories = getGuestHistory();

    const newHistory: LetterHistory = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        targetCompany: inputs.companyName,
        targetName: inputs.name,
        content,
        isPinned: false,
        mode,
        status: 'generated',
        inputs
    };

    // Add to beginning
    const updated = [newHistory, ...histories];

    // Limit to MAX_ITEMS
    const trimmed = updated.slice(0, MAX_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    return newHistory;
}

export function deleteGuestHistory(id: string): LetterHistory[] {
    const histories = getGuestHistory();
    const updated = histories.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}
