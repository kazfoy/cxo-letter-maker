import { create } from 'zustand';
import type { LetterFormData, LetterMode, LetterStatus, LetterHistory } from '@/types/letter';
import type { AnalysisResult, InformationSource } from '@/types/analysis';
import type { Citation } from '@/types/generate-v2';
import type { ErrorKind } from '@/lib/errorUtils';

const EMPTY_FORM: LetterFormData = {
  myCompanyName: '',
  myName: '',
  myServiceDescription: '',
  companyName: '',
  position: '',
  name: '',
  targetUrl: '',
  background: '',
  problem: '',
  solution: '',
  caseStudy: '',
  offer: '',
  freeformInput: '',
  eventUrl: '',
  eventName: '',
  eventDateTime: '',
  eventSpeakers: '',
  invitationReason: '',
  simpleRequirement: '',
};

interface LetterState {
  // Form
  formData: LetterFormData;
  mode: LetterMode;
  formErrors: Record<string, string>;

  // Analysis
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  resolvedTargetUrl: string | undefined;

  // Generation
  generatedLetter: string;
  variations: { standard: string; emotional: string; consultative: string } | undefined;
  activeVariation: 'standard' | 'emotional' | 'consultative';
  emailData: { subject: string; body: string } | undefined;
  isGenerating: boolean;
  isGeneratingV2: boolean;
  isQuickDrafting: boolean;
  generatedSources: InformationSource[] | undefined;
  generatedCitations: Citation[] | undefined;
  selfCheck: string[] | undefined;
  generationError: string | null;
  generationErrorKind: ErrorKind | null;
  modalError: string | null;

  // History
  currentLetterId: string | undefined;
  currentLetterStatus: LetterStatus | undefined;

  // Demo
  isDemoMode: boolean;
  isSampleCooldown: boolean;

  // Actions
  setFormData: (data: LetterFormData | ((prev: LetterFormData) => LetterFormData)) => void;
  setMode: (mode: LetterMode) => void;
  setFormErrors: (errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  clearFormError: (field: string) => void;

  setAnalysisResult: (result: AnalysisResult | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setResolvedTargetUrl: (url: string | undefined) => void;

  setGeneratedLetter: (letter: string) => void;
  setVariations: (v: { standard: string; emotional: string; consultative: string } | undefined) => void;
  setActiveVariation: (v: 'standard' | 'emotional' | 'consultative') => void;
  setEmailData: (data: { subject: string; body: string } | undefined) => void;
  setIsGenerating: (v: boolean) => void;
  setIsGeneratingV2: (v: boolean) => void;
  setIsQuickDrafting: (v: boolean) => void;
  setGeneratedSources: (sources: InformationSource[] | undefined) => void;
  setGeneratedCitations: (citations: Citation[] | undefined) => void;
  setSelfCheck: (checks: string[] | undefined) => void;
  setGenerationError: (error: string | null) => void;
  setGenerationErrorKind: (kind: ErrorKind | null) => void;
  setModalError: (error: string | null) => void;

  setCurrentLetterId: (id: string | undefined) => void;
  setCurrentLetterStatus: (status: LetterStatus | undefined) => void;

  setIsDemoMode: (v: boolean) => void;
  setIsSampleCooldown: (v: boolean) => void;

  // Compound actions
  resetForm: () => void;
  resetGeneration: () => void;
  restoreFromHistory: (history: LetterHistory) => void;
}

export const useLetterStore = create<LetterState>((set) => ({
  // Form
  formData: { ...EMPTY_FORM },
  mode: 'sales',
  formErrors: {},

  // Analysis
  analysisResult: null,
  isAnalyzing: false,
  resolvedTargetUrl: undefined,

  // Generation
  generatedLetter: '',
  variations: undefined,
  activeVariation: 'standard',
  emailData: undefined,
  isGenerating: false,
  isGeneratingV2: false,
  isQuickDrafting: false,
  generatedSources: undefined,
  generatedCitations: undefined,
  selfCheck: undefined,
  generationError: null,
  generationErrorKind: null,
  modalError: null,

  // History
  currentLetterId: undefined,
  currentLetterStatus: undefined,

  // Demo
  isDemoMode: false,
  isSampleCooldown: false,

  // Actions
  setFormData: (data) =>
    set((s) => ({
      formData: typeof data === 'function' ? data(s.formData) : data,
    })),
  setMode: (mode) => set({ mode }),
  setFormErrors: (errors) =>
    set((s) => ({
      formErrors: typeof errors === 'function' ? errors(s.formErrors) : errors,
    })),
  clearFormError: (field) =>
    set((s) => {
      const next = { ...s.formErrors };
      delete next[field];
      return { formErrors: next };
    }),

  setAnalysisResult: (result) => set({ analysisResult: result }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setResolvedTargetUrl: (url) => set({ resolvedTargetUrl: url }),

  setGeneratedLetter: (letter) => set({ generatedLetter: letter }),
  setVariations: (v) => set({ variations: v }),
  setActiveVariation: (v) => set({ activeVariation: v }),
  setEmailData: (data) => set({ emailData: data }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsGeneratingV2: (v) => set({ isGeneratingV2: v }),
  setIsQuickDrafting: (v) => set({ isQuickDrafting: v }),
  setGeneratedSources: (sources) => set({ generatedSources: sources }),
  setGeneratedCitations: (citations) => set({ generatedCitations: citations }),
  setSelfCheck: (checks) => set({ selfCheck: checks }),
  setGenerationError: (error) => set({ generationError: error }),
  setGenerationErrorKind: (kind) => set({ generationErrorKind: kind }),
  setModalError: (error) => set({ modalError: error }),

  setCurrentLetterId: (id) => set({ currentLetterId: id }),
  setCurrentLetterStatus: (status) => set({ currentLetterStatus: status }),

  setIsDemoMode: (v) => set({ isDemoMode: v }),
  setIsSampleCooldown: (v) => set({ isSampleCooldown: v }),

  // Compound actions
  resetForm: () =>
    set({
      formData: { ...EMPTY_FORM },
      generatedLetter: '',
      currentLetterId: undefined,
      currentLetterStatus: undefined,
      variations: undefined,
      emailData: undefined,
      generatedSources: undefined,
      generatedCitations: undefined,
      selfCheck: undefined,
      analysisResult: null,
      generationError: null,
      generationErrorKind: null,
    }),

  resetGeneration: () =>
    set({
      variations: undefined,
      emailData: undefined,
      generationError: null,
      generationErrorKind: null,
      selfCheck: undefined,
    }),

  restoreFromHistory: (history) =>
    set({
      formData: history.inputs,
      generatedLetter: history.content,
      currentLetterId: history.id,
      currentLetterStatus: history.status,
      generatedSources: history.sources,
      generatedCitations: history.citations,
    }),
}));

export { EMPTY_FORM };
