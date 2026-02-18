import { usePlatforms } from './hooks/usePlatforms.js';
import { useRegion } from './hooks/useRegion.js';
import { useSelectedPlatforms } from './hooks/useSelectedPlatforms.js';
import PlatformSelector from './components/PlatformSelector.jsx';
import RecommendationCard from './components/RecommendationCard.jsx';

// Mock data to validate component rendering before AI integration (Milestone 2)
const MOCK_RECOMMENDATIONS = [
  {
    id: 1,
    title: 'Severance',
    year: 2022,
    mediaType: 'tv',
    posterPath: '/nBD7DOyBDL0ooVeXDNqEYFrJTZg.jpg',
    rating: 8.7,
    genres: [{ id: 18, name: 'Drama' }, { id: 878, name: 'Sci-Fi' }],
    platforms: [{ id: 'apple-tv', name: 'Apple TV+', brandColor: '#000000' }],
    whyItMatches:
      'Perfect for when you want something cerebral and unlike anything else on TV. A slow-burn thriller that rewards patience.',
  },
  {
    id: 2,
    title: 'Ted Lasso',
    year: 2020,
    mediaType: 'tv',
    posterPath: '/t28MlQxdDcLkLY4opfRCqFCMjQ3.jpg',
    rating: 8.8,
    genres: [{ id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' }],
    platforms: [{ id: 'apple-tv', name: 'Apple TV+', brandColor: '#000000' }],
    whyItMatches:
      'Genuinely uplifting without being saccharine. Great if you want to feel good without turning your brain off.',
  },
];

export default function App() {
  const { region, loading: regionLoading } = useRegion();
  const { platforms, loading: platformsLoading } = usePlatforms(region?.countryCode);
  const [selectedPlatforms, setSelectedPlatforms] = useSelectedPlatforms();

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

        {/* Mock recommendation cards — replaced by AI results in Milestone 2 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Recommended for you</h2>
          {MOCK_RECOMMENDATIONS.map((rec) => (
            <RecommendationCard key={rec.id} {...rec} />
          ))}
        </div>
      </div>
    </div>
  );
}
