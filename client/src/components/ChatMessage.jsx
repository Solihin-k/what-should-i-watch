import RecommendationCard from './RecommendationCard.jsx';

export default function ChatMessage({ role, content, recommendations = [], chips, onChipClick, retryable, onRetry }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md',
        ].join(' ')}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>

        {chips && chips.length > 0 && onChipClick && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.message}
                onClick={() => onChipClick(chip.message)}
                className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id ?? rec.title} {...rec} />
            ))}
          </div>
        )}

        {!isUser && retryable && onRetry && recommendations.length === 0 && content && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
