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
          className="ml-auto px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1 text-xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
          Edit
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
              className="shrink-0 w-full py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-100 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.134l.218.216a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39c-.3.11-.6.245-.517.407zm.176-8.058a.75.75 0 00-1.5 0v2.134l-.218-.216a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311h-2.433a.75.75 0 000 1.5H15.22a.75.75 0 00.75-.75V3.366z" clipRule="evenodd" />
              </svg>
              Start Over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
