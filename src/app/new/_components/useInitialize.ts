'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestLimit } from '@/hooks/useGuestLimit';
import { getProfile } from '@/lib/profileUtils';
import { getRandomPrecomputedSample } from '@/lib/sampleLetters';
import { SAMPLE_DATA } from '@/lib/sampleData';
import { normalizeLetterText } from '@/lib/textNormalize';
import { createClient } from '@/utils/supabase/client';
import { devLog } from '@/lib/logger';
import type { LetterFormData, LetterMode, LetterStatus } from '@/types/letter';

export function useInitialize() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const restoreId = searchParams.get('restore');
  const isDemo = searchParams.get('demo') === 'true';
  const { usage } = useGuestLimit();

  const store = useLetterStore();
  const ui = useUiStore();

  // Load profile data
  useEffect(() => {
    const loadProfileData = async () => {
      if (user && !ui.profileLoaded) {
        try {
          const profile = await getProfile();
          if (profile) {
            store.setFormData((prev) => ({
              ...prev,
              myCompanyName: profile.company_name || '',
              myName: profile.user_name || '',
              myServiceDescription: profile.service_description || '',
            }));
            ui.setProfileLoaded(true);
          }
        } catch (error) {
          devLog.error('Failed to load profile:', error);
        }
      }
    };
    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ui.profileLoaded]);

  // Show limit modal when limit reached
  useEffect(() => {
    if (usage?.isLimitReached && !user) {
      ui.setShowLimitModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage, user]);

  // Demo mode
  useEffect(() => {
    if (!isDemo) return;
    store.setIsDemoMode(true);

    const timer = setTimeout(async () => {
      const { sample } = getRandomPrecomputedSample();

      const sampleFormData: LetterFormData = {
        myCompanyName: SAMPLE_DATA.myCompanyName,
        myName: SAMPLE_DATA.myName,
        myServiceDescription: SAMPLE_DATA.myServiceDescription,
        companyName: sample.companyName,
        department: SAMPLE_DATA.department,
        position: SAMPLE_DATA.position,
        name: SAMPLE_DATA.name,
        targetUrl: sample.targetUrl,
        background: '', problem: '', solution: '', caseStudy: '', offer: '',
        freeformInput: '', eventUrl: '', eventName: '', eventDateTime: '',
        eventSpeakers: '', invitationReason: '', simpleRequirement: '',
      };
      store.setFormData(sampleFormData);

      store.setIsGenerating(true);
      store.setIsAnalyzing(true);
      await new Promise((r) => setTimeout(r, 1500));
      store.setIsAnalyzing(false);
      store.setAnalysisResult(sample.analysisResult);
      store.setGeneratedSources(sample.sources);

      await new Promise((r) => setTimeout(r, 1500));

      store.setGeneratedLetter(normalizeLetterText(sample.letters.standard.body));
      store.setVariations({
        standard: normalizeLetterText(sample.letters.standard.body),
        emotional: normalizeLetterText(sample.letters.emotional.body),
        consultative: normalizeLetterText(sample.letters.consultative.body),
      });
      store.setActiveVariation('standard');
      store.setIsGenerating(false);
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // Restore from history
  useEffect(() => {
    const restoreLetter = async () => {
      if (!restoreId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('letters')
          .select('*')
          .eq('id', restoreId)
          .single();

        if (error || !data) {
          devLog.error('Failed to fetch letter:', error);
          return;
        }

        if (data.inputs) {
          store.setFormData(data.inputs as LetterFormData);
        }
        if (data.content) {
          store.setGeneratedLetter(normalizeLetterText(data.content));
        }
        if (data.mode) {
          store.setMode(data.mode as LetterMode);
        }
        store.setCurrentLetterId(data.id);
        store.setCurrentLetterStatus(data.status as LetterStatus);
        if (data.email_content) {
          store.setEmailData(data.email_content as { subject: string; body: string });
        }
      } catch (error) {
        devLog.error('Error restoring letter:', error);
      }
    };

    restoreLetter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreId]);
}
