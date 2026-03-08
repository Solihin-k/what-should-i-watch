import { useState, useCallback } from 'react';
import { usePlatforms } from './hooks/usePlatforms.js';
import { useRegion } from './hooks/useRegion.js';
import { useSelectedPlatforms } from './hooks/useSelectedPlatforms.js';
import { useChat } from './hooks/useChat.js';
import PlatformSelector from './components/PlatformSelector.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import GuidedFlow from './components/GuidedFlow.jsx';

export default function App() {
  const { region, loading: regionLoading } = useRegion();
  const { platforms, loading: platformsLoading } = usePlatforms(region?.countryCode);
  const [selectedPlatforms, setSelectedPlatforms] = useSelectedPlatforms();
  const { messages, sendMessage, loading: chatLoading, error: chatError, retryLastMessage, resetChat, injectInitialRecommendations } = useChat(
    selectedPlatforms,
    region?.countryCode
  );

  // Three-phase flow: 'platforms' → 'guided' → 'results'
  const [appPhase, setAppPhase] = useState('platforms');

  const isLoading = regionLoading || platformsLoading;

  const handlePlatformChange = useCallback((newSelected) => {
    setSelectedPlatforms(newSelected);
  }, [setSelectedPlatforms]);

  const handlePlatformContinue = useCallback(() => {
    if (selectedPlatforms.length > 0) {
      setAppPhase('guided');
    }
  }, [selectedPlatforms]);

  const handleGuidedComplete = useCallback((tags, summaryMessage, response) => {
    injectInitialRecommendations(summaryMessage, response);
    setAppPhase('results');
  }, [injectInitialRecommendations]);

  const handleStartOver = useCallback(() => {
    resetChat();
    setAppPhase('guided');
  }, [resetChat]);

  const handleChangePlatforms = useCallback(() => {
    resetChat();
    setAppPhase('platforms');
  }, [resetChat]);

  // Collapsed platform summary for guided and results phases
  const PlatformSummary = () => {
    const selectedPlatformObjects = platforms.filter((p) => selectedPlatforms.includes(p.id));
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Platforms:</span>
        <div className="flex gap-1.5">
          {selectedPlatformObjects.map((p) => (
            <span key={p.id} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700">
              {p.name}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={handleChangePlatforms}
          className="text-xs text-indigo-600 hover:text-indigo-800 ml-auto"
        >
          Change
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0 py-6 px-4 gap-4">
        {/* Header */}
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">What Should I Watch?</h1>
          {region && !regionLoading && (
            <p className="text-sm text-gray-500 mt-1">
              Showing availability for {region.countryName}
            </p>
          )}
        </div>

        {/* Platform Selection Phase */}
        {appPhase === 'platforms' && (
          <div className="shrink-0 flex flex-col gap-4">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading platforms...</p>
            ) : (
              <>
                <PlatformSelector
                  platforms={platforms}
                  selected={selectedPlatforms}
                  onChange={handlePlatformChange}
                />
                {selectedPlatforms.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePlatformContinue}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all duration-150"
                  >
                    Continue
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Guided Flow Phase */}
        {appPhase === 'guided' && (
          <>
            <div className="shrink-0">
              <PlatformSummary />
            </div>
            <GuidedFlow
              onComplete={handleGuidedComplete}
              selectedPlatforms={selectedPlatforms}
              region={region?.countryCode}
            />
          </>
        )}

        {/* Results + Chat Phase */}
        {appPhase === 'results' && (
          <>
            <div className="shrink-0">
              <PlatformSummary />
            </div>
            <ChatWindow
              messages={messages}
              onSend={sendMessage}
              loading={chatLoading}
              error={chatError}
              onRetry={retryLastMessage}
            />
            <button
              type="button"
              onClick={handleStartOver}
              className="shrink-0 text-sm text-gray-500 hover:text-gray-700 text-center py-2 transition-colors"
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
