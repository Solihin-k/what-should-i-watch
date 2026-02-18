import { usePlatforms } from './hooks/usePlatforms.js';
import { useRegion } from './hooks/useRegion.js';
import { useSelectedPlatforms } from './hooks/useSelectedPlatforms.js';
import { useRecommendations } from './hooks/useRecommendations.js';
import PlatformSelector from './components/PlatformSelector.jsx';
import RecommendationCard from './components/RecommendationCard.jsx';

export default function App() {
  const { region, loading: regionLoading } = useRegion();
  const { platforms, loading: platformsLoading } = usePlatforms(region?.countryCode);
  const [selectedPlatforms, setSelectedPlatforms] = useSelectedPlatforms();
  const { recommendations, loading: recsLoading, error: recsError } = useRecommendations(
    selectedPlatforms,
    region?.countryCode
  );

  const isLoading = regionLoading || platformsLoading;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">What Should I Watch?</h1>
          {region && !regionLoading && (
            <p className="text-sm text-gray-500 mt-1">
              Showing availability for {region.countryName}
            </p>
          )}
        </div>

        {/* Platform Selector */}
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading platforms...</p>
        ) : (
          <PlatformSelector
            platforms={platforms}
            selected={selectedPlatforms}
            onChange={setSelectedPlatforms}
          />
        )}

        {/* Recommendations */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Recommended for you</h2>

          {selectedPlatforms.length === 0 ? (
            <p className="text-sm text-gray-500">
              Select your platforms above to see what&apos;s available.
            </p>
          ) : recsLoading ? (
            <p className="text-sm text-gray-500">Finding what&apos;s available&hellip;</p>
          ) : recsError ? (
            <p className="text-sm text-red-500">
              Something went wrong loading recommendations. Please try again.
            </p>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nothing found for your selected platforms in {region?.countryName || 'your region'}.
              Try adding more platforms.
            </p>
          ) : (
            recommendations.map((rec) => (
              <RecommendationCard key={rec.id} {...rec} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
