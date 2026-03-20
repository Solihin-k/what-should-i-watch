import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1 items-center">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, onSend, loading, error, onRetry }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive or loading changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            {...msg}
            onChipClick={onSend}
            onRetry={msg.retryable ? onRetry : undefined}
          />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="text-sm text-red-500 px-2">
            Something went wrong. Please try again.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

    </div>
  );
}
