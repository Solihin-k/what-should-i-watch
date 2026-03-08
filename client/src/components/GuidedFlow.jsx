import { useEffect } from 'react';
import { STEPS } from '../utils/tileConfig.js';
import { useGuidedFlow } from '../hooks/useGuidedFlow.js';
import { sendGuidedRecommendation } from '../services/api.js';
import ProgressBar from './ProgressBar.jsx';
import SelectedChips from './SelectedChips.jsx';
import TileStep from './TileStep.jsx';
import GuidedLoading from './GuidedLoading.jsx';

export default function GuidedFlow({ onComplete, selectedPlatforms, region }) {
  const {
    currentStep,
    selections,
    status,
    tags,
    summaryMessage,
    totalSteps,
    isMultiSelect,
    selectedTileIds,
    selectTile,
    confirmStep,
    goBack,
    goToStep,
    reset,
    setStatus,
  } = useGuidedFlow();

  // Build chip data from selections for display (flatten multi-select into individual chips)
  const chipSelections = [];
  for (const sel of selections) {
    const step = STEPS[sel.stepIndex];
    if (!step) continue;
    if (sel.tileIds) {
      // Multi-select: one chip per selected tile
      for (const tileId of sel.tileIds) {
        const tile = step.tiles.find((t) => t.id === tileId);
        if (tile) chipSelections.push({ stepIndex: sel.stepIndex, icon: tile.icon, label: tile.label });
      }
    } else {
      const tile = step.tiles.find((t) => t.id === sel.tileId);
      if (tile) chipSelections.push({ stepIndex: sel.stepIndex, icon: tile.icon, label: tile.label });
    }
  }

  // Trigger API call when all steps are completed
  useEffect(() => {
    if (status !== 'loading') return;

    let cancelled = false;

    async function fetchRecommendations() {
      try {
        const response = await sendGuidedRecommendation({
          tags,
          platforms: selectedPlatforms,
          region,
        });

        if (!cancelled) {
          setStatus('complete');
          onComplete(tags, summaryMessage, response);
        }
      } catch (err) {
        console.error('[GuidedFlow] Failed to get recommendations:', err);
        if (!cancelled) {
          setStatus('active');
          // Go back to last step so user can retry
          goToStep(STEPS.length - 1);
        }
      }
    }

    fetchRecommendations();
    return () => { cancelled = true; };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading' || status === 'complete') {
    return <GuidedLoading selections={chipSelections} />;
  }

  const step = STEPS[currentStep];

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />

      <SelectedChips selections={chipSelections} onChipClick={goToStep} />

      {currentStep > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="self-start text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          <span>←</span> Back
        </button>
      )}

      <TileStep
        key={step.id}
        question={step.question}
        tiles={step.tiles}
        onSelect={selectTile}
        multiSelect={step.multiSelect}
        selectedTileIds={selectedTileIds}
        onConfirm={confirmStep}
      />
    </div>
  );
}
