import RecommendationCard from './RecommendationCard.jsx';
import VibeTile from './VibeTile.jsx';

export default function ChatMessage({ role, content, recommendations = [], chips, onChipClick, retryable, onRetry }) {
  const isUser = role === 'user';
  const hasRecs = recommendations.length > 0;

  // Show chips as tiles when they appear alongside recommendations (follow-up options)
  const showChipsAsTiles = hasRecs && chips && chips.length > 0;
  const showChipsInline = !hasRecs && chips && chips.length > 0;

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

        {showChipsInline && onChipClick && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.message}
                onClick={() => onChipClick(chip.message)}
                className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                {chip.icon ? `${chip.icon} ${chip.label}` : chip.label}
              </button>
            ))}
          </div>
        )}

        {hasRecs && (
          <div className="mt-3 flex flex-col gap-3">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id ?? rec.title} {...rec} />
            ))}
          </div>
        )}

        {showChipsAsTiles && onChipClick && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">What next?</p>
            <div className="grid grid-cols-2 gap-2">
              {chips.map((chip) => (
                <VibeTile
                  key={chip.message}
                  icon={chip.icon || '💬'}
                  label={chip.label}
                  compact
                  onClick={() => onChipClick(chip.message)}
                />
              ))}
            </div>
          </div>
        )}

        {!isUser && retryable && onRetry && recommendations.length === 0 && content && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors px-3 py-1.5"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
