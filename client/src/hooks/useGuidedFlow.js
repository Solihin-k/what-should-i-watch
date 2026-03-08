import { useState, useCallback } from 'react';
import { STEPS, buildTagsFromSelections, buildSummaryMessage } from '../utils/tileConfig.js';

export function useGuidedFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState([]);
  const [status, setStatus] = useState('active'); // 'active' | 'loading' | 'complete'

  const isMultiSelect = STEPS[currentStep]?.multiSelect === true;

  const selectTile = useCallback((tileId) => {
    const step = STEPS[currentStep];
    if (step?.multiSelect) {
      // Toggle tile in multi-select mode
      setSelections((prev) => {
        const existing = prev.find((s) => s.stepIndex === currentStep);
        if (existing) {
          const ids = existing.tileIds || [];
          const newIds = ids.includes(tileId)
            ? ids.filter((id) => id !== tileId)
            : [...ids, tileId];
          return [...prev.filter((s) => s.stepIndex !== currentStep), { stepIndex: currentStep, tileIds: newIds }];
        }
        return [...prev.slice(0, currentStep), { stepIndex: currentStep, tileIds: [tileId] }];
      });
      return;
    }

    // Single-select: auto-advance
    const newSelection = { stepIndex: currentStep, tileId };
    const newSelections = [...selections.slice(0, currentStep), newSelection];
    setSelections(newSelections);

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setStatus('loading');
    }
  }, [currentStep, selections]);

  const confirmStep = useCallback(() => {
    // Advance from a multi-select step
    const existing = selections.find((s) => s.stepIndex === currentStep);
    if (!existing || !(existing.tileIds?.length > 0)) return;

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setStatus('loading');
    }
  }, [currentStep, selections]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setSelections((prev) => prev.filter((s) => s.stepIndex < currentStep - 1));
      setCurrentStep(currentStep - 1);
      setStatus('active');
    }
  }, [currentStep]);

  const goToStep = useCallback((n) => {
    setSelections((prev) => prev.filter((s) => s.stepIndex < n));
    setCurrentStep(n);
    setStatus('active');
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setSelections([]);
    setStatus('active');
  }, []);

  const tags = buildTagsFromSelections(selections);
  const summaryMessage = buildSummaryMessage(selections);

  // Get selected tile IDs for current multi-select step
  const currentSelection = selections.find((s) => s.stepIndex === currentStep);
  const selectedTileIds = currentSelection?.tileIds || [];

  return {
    currentStep,
    selections,
    status,
    tags,
    summaryMessage,
    totalSteps: STEPS.length,
    isMultiSelect,
    selectedTileIds,
    selectTile,
    confirmStep,
    goBack,
    goToStep,
    reset,
    setStatus,
  };
}
