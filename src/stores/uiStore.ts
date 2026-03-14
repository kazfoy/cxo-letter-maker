import { create } from 'zustand';

interface UiState {
  isSidebarOpen: boolean;
  showLimitModal: boolean;
  showAnalysisModal: boolean;
  refreshHistoryTrigger: number;
  profileLoaded: boolean;

  setIsSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setShowLimitModal: (v: boolean) => void;
  setShowAnalysisModal: (v: boolean) => void;
  triggerHistoryRefresh: () => void;
  setProfileLoaded: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  showLimitModal: false,
  showAnalysisModal: false,
  refreshHistoryTrigger: 0,
  profileLoaded: false,

  setIsSidebarOpen: (v) => set({ isSidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setShowLimitModal: (v) => set({ showLimitModal: v }),
  setShowAnalysisModal: (v) => set({ showAnalysisModal: v }),
  triggerHistoryRefresh: () =>
    set((s) => ({ refreshHistoryTrigger: s.refreshHistoryTrigger + 1 })),
  setProfileLoaded: (v) => set({ profileLoaded: v }),
}));
