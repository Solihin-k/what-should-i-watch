const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';

// Star rating — rounds to nearest half star visually, shows numeric score
function StarRating({ rating }) {
  const stars = Math.round((rating / 10) * 5 * 2) / 2;
  return (
    <div className="flex items-center gap-1">
      <span className="text-yellow-400 text-sm">{'★'.repeat(Math.floor(stars))}</span>
      <span className="text-xs text-gray-500">{rating.toFixed(1)}/10</span>
    </div>
  );
}

// RecommendationCard displays a single content recommendation
// Props: title, year, mediaType, posterPath, rating, genres, platforms, whyItMatches
export default function RecommendationCard({
  title,
  year,
  mediaType,
  posterPath,
  rating,
  genres = [],
  platforms = [],
  whyItMatches,
}) {
  const posterUrl = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;

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

        {/* Rating */}
        {rating != null && <StarRating rating={rating} />}

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

        {/* Why it matches */}
        {whyItMatches && (
          <p className="text-sm text-gray-600 italic border-l-2 border-indigo-300 pl-3 mt-1">
            {whyItMatches}
          </p>
        )}
      </div>
    </div>
  );
}
