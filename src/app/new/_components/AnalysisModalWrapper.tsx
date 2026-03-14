'use client';

import { AnalysisPreviewModal } from '@/components/AnalysisPreviewModal';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';
import { useLetterActions } from './useLetterActions';
import { sanitizePersonName } from '@/lib/personNameUtils';

export function AnalysisModalWrapper() {
  const {
    analysisResult,
    isGeneratingV2,
    resolvedTargetUrl,
    mode,
    modalError,
    setModalError,
    formData,
    setFormData,
  } = useLetterStore();
  const { showAnalysisModal, setShowAnalysisModal } = useUiStore();
  const { handleGenerateV2 } = useLetterActions();

  return (
    <AnalysisPreviewModal
      isOpen={showAnalysisModal}
      onClose={() => {
        setShowAnalysisModal(false);
        setModalError(null);
      }}
      analysisResult={analysisResult}
      onConfirm={handleGenerateV2}
      isLoading={isGeneratingV2}
      hasUrl={Boolean(resolvedTargetUrl)}
      letterMode={mode}
      error={modalError}
      onClearError={() => setModalError(null)}
      onDraftFallback={() => {
        setModalError(null);
        handleGenerateV2({}, 'draft');
      }}
      currentFormData={{
        companyName: formData.companyName,
        name: formData.name,
        position: formData.position,
      }}
      onApplyFacts={(facts) => {
        setFormData((prev) => ({
          ...prev,
          ...(facts.companyName ? { companyName: facts.companyName } : {}),
          ...(facts.name ? { name: sanitizePersonName(facts.name) } : {}),
          ...(facts.position ? { position: facts.position } : {}),
        }));
      }}
    />
  );
}
