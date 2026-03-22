import { useState } from 'react';
import { sendFeedback } from '../services/api.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// RecommendationCard displays a single content recommendation
// Props: title, year, mediaType, posterPath, genres, platforms, whyItMatches
export default function RecommendationCard({
  title,
  year,
  mediaType,
  posterPath,
  genres = [],
  platforms = [],
  whyItMatches,
  unverified,
  source,
  topComments = [],
}) {
  const posterUrl = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;
  const [feedback, setFeedback] = useState(null);

  const handleFeedback = async (type) => {
    setFeedback(type);
    try {
      await sendFeedback(title, type);
    } catch {
      // Feedback is best-effort — don't disrupt UX
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col sm:flex-row">
      {/* Poster */}
      <div className="w-full sm:w-32 shrink-0 bg-gray-100">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${title} poster`}
            className="w-full h-48 sm:h-full object-cover"
          />
        ) : (
          <div className="w-full h-48 sm:h-full flex items-center justify-center bg-gray-200">
            <span className="text-4xl text-gray-400">🎬</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Title row */}
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{title}</h3>
          {year && <span className="text-sm text-gray-500 shrink-0 mt-0.5">({year})</span>}
          <span
            className={[
              'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
              mediaType === 'movie'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700',
            ].join(' ')}
          >
            {mediaType === 'movie' ? 'Movie' : 'Series'}
          </span>
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.map((genre) => (
              <span
                key={genre.id ?? genre}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {genre.name ?? genre}
              </span>
            ))}
          </div>
        )}

        {/* Platforms */}
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <span
                key={platform.id ?? platform.provider_id ?? platform.name}
                className="text-xs font-semibold px-2 py-1 rounded-lg text-white"
                style={{ backgroundColor: platform.brandColor || '#374151' }}
              >
                {platform.name ?? platform.provider_name}
              </span>
            ))}
          </div>
        )}
        {source === 'community' && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 self-start">
            Community Pick
          </span>
        )}
        {source === 'popular' && platforms.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 self-start">
            Popular on {platforms[0].name}
          </span>
        )}
        {unverified && (
          <p className="text-xs text-gray-400 mt-1">
            Availability may vary — check Viki to confirm
          </p>
        )}

        {/* Why it matches */}
        {whyItMatches && (
          <p className="text-sm text-gray-600 italic border-l-2 border-indigo-300 pl-3 mt-1">
            {whyItMatches}
          </p>
        )}

        {/* Social proof — Reddit comments */}
        {topComments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            {topComments.slice(0, 2).map((comment, i) => (
              <p
                key={i}
                className={[
                  'text-xs text-gray-400 italic',
                  i === 1 ? 'hidden sm:block' : '',
                ].join(' ')}
              >
                <span className="not-italic">💬</span> &ldquo;{comment.text}&rdquo; — <span className="text-gray-500">{comment.subreddit}</span>
              </p>
            ))}
          </div>
        )}

        {/* Feedback */}
        <div className="flex items-center gap-1 mt-1">
          <button
            type="button"
            onClick={() => handleFeedback('up')}
            disabled={feedback !== null}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-full transition-colors text-sm',
              feedback === 'up'
                ? 'bg-green-100 text-green-600'
                : feedback === null
                  ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  : 'text-gray-300',
            ].join(' ')}
            aria-label="Thumbs up"
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => handleFeedback('down')}
            disabled={feedback !== null}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-full transition-colors text-sm',
              feedback === 'down'
                ? 'bg-red-100 text-red-600'
                : feedback === null
                  ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  : 'text-gray-300',
            ].join(' ')}
            aria-label="Thumbs down"
          >
            👎
          </button>
        </div>
      </div>
    </div>
  );
}
