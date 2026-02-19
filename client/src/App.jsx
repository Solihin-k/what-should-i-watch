import { usePlatforms } from './hooks/usePlatforms.js';
import { useRegion } from './hooks/useRegion.js';
import { useSelectedPlatforms } from './hooks/useSelectedPlatforms.js';
import { useChat } from './hooks/useChat.js';
import PlatformSelector from './components/PlatformSelector.jsx';
import ChatWindow from './components/ChatWindow.jsx';

export default function App() {
  const { region, loading: regionLoading } = useRegion();
  const { platforms, loading: platformsLoading } = usePlatforms(region?.countryCode);
  const [selectedPlatforms, setSelectedPlatforms] = useSelectedPlatforms();
  const { messages, sendMessage, loading: chatLoading, error: chatError } = useChat(
    selectedPlatforms,
    region?.countryCode
  );

  const isLoading = regionLoading || platformsLoading;

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

        {/* Platform Selector */}
        <div className="shrink-0">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading platforms...</p>
          ) : (
            <PlatformSelector
              platforms={platforms}
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
            />
          )}
        </div>

        {/* Chat Area */}
        {selectedPlatforms.length === 0 ? (
          <p className="text-sm text-gray-500">
            Select your platforms above to start chatting.
          </p>
        ) : (
          <ChatWindow
            messages={messages}
            onSend={sendMessage}
            loading={chatLoading}
            error={chatError}
          />
        )}
      </div>
    </div>
  );
}
