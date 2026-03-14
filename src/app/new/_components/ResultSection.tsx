'use client';

import { PreviewArea } from '@/components/PreviewArea';
import { QualityComparisonBanner } from '@/components/QualityComparisonBanner';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useLetterActions } from './useLetterActions';

export function ResultSection() {
  const store = useLetterStore();
  const { triggerHistoryRefresh } = useUiStore();
  const { isFree } = useUserPlan();

  const { handleSaveOnly, handleSampleExperience, handleExitDemo } = useLetterActions();

  const hasLetter = Boolean(store.generatedLetter && !store.isGenerating);

  return (
    <>
      <PreviewArea
        content={store.generatedLetter}
        onContentChange={(newContent) => {
          store.setGeneratedLetter(newContent);
          if (store.variations) {
            store.setVariations({
              ...store.variations,
              [store.activeVariation]: newContent,
            });
          }
        }}
        isGenerating={store.isGenerating}
        isAnalyzing={store.isAnalyzing}
        currentLetterId={store.currentLetterId}
        currentStatus={store.currentLetterStatus}
        onStatusChange={triggerHistoryRefresh}
        variations={store.variations}
        activeVariation={store.activeVariation}
        onVariationSelect={(variation) => {
          store.setActiveVariation(variation);
          if (store.variations) {
            store.setGeneratedLetter(store.variations[variation]);
          }
        }}
        emailData={store.emailData}
        onEmailChange={(newEmail) => {
          store.setEmailData(newEmail);
          store.setGeneratedLetter(`件名: ${newEmail.subject}\n\n${newEmail.body}`);
        }}
        onSave={handleSaveOnly}
        sources={store.generatedSources}
        citations={store.generatedCitations}
        hasUrl={Boolean(store.resolvedTargetUrl || store.formData.targetUrl)}
        selfCheck={store.selfCheck}
        letterMode={store.mode}
        onSampleFill={handleSampleExperience}
        isDemoMode={store.isDemoMode}
        onExitDemo={handleExitDemo}
      />
      {isFree && !store.isDemoMode && (
        <QualityComparisonBanner hasLetter={hasLetter} />
      )}
    </>
  );
}
