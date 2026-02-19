import PLATFORMS from '../config/platforms.js';
import { getRecommendations } from './claudeService.js';
import { validateTitle } from './tmdbService.js';

export async function generateRecommendations({ message, platforms, region, conversationHistory = [] }) {
  // Map platform IDs to full platform objects and TMDB provider IDs
  const selectedPlatforms = platforms
    .map((id) => PLATFORMS.find((p) => p.id === id))
    .filter(Boolean);

  const platformProviderIds = selectedPlatforms.map((p) => p.tmdbProviderId);

  // Get Claude's recommendations — graceful fallback if Claude is entirely unreachable
  console.log('[Recommend] Calling Claude for:', message.substring(0, 80), '| Platforms:', selectedPlatforms.map((p) => p.id).join(', '));
  let claudeResult;
  try {
    claudeResult = await getRecommendations({
      message,
      platforms: selectedPlatforms,
      region,
      conversationHistory,
    });
    console.log('[Recommend] Claude returned', claudeResult.recommendations.length, 'recommendations');
  } catch (err) {
    console.error('[Recommend] Claude service failed entirely:', err.message);
    return {
      recommendations: [],
      followUpMessage: "I'm having trouble connecting right now. Please try again in a moment.",
    };
  }

  // If Claude returned a clarifying question (0 recommendations), pass it through
  if (claudeResult.recommendations.length === 0) {
    return {
      recommendations: [],
      followUpMessage: claudeResult.followUpMessage,
    };
  }

  // Validate each recommendation against TMDB in parallel
  const validationResults = await Promise.allSettled(
    claudeResult.recommendations.map((rec) =>
      validateTitle({
        title: rec.title,
        year: rec.year,
        type: rec.type,
        region,
        platformProviderIds,
      })
    )
  );

  const recommendations = [];
  const unavailableTitles = [];
  console.log('[Recommend] Validating', validationResults.length, 'titles against TMDB');

  validationResults.forEach((result, index) => {
    const rec = claudeResult.recommendations[index];

    if (result.status === 'fulfilled' && result.value) {
      const validated = result.value;
      const releaseDate = validated.release_date || '';
      const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

      // Map matched TMDB providers back to our platform objects for display
      const matchedPlatformObjects = validated.matchedPlatforms
        .map((provider) => selectedPlatforms.find((p) => p.tmdbProviderId === provider.provider_id))
        .filter(Boolean);

      recommendations.push({
        id: validated.id,
        title: validated.title,
        year,
        mediaType: validated.mediaType,
        posterPath: validated.poster_path || null,
        rating: validated.vote_average ?? null,
        genres: (validated.genres || []).map((g) => ({ id: g.id, name: g.name })),
        platforms: matchedPlatformObjects.map((p) => ({
          id: p.id,
          name: p.name,
          brandColor: p.brandColor,
        })),
        whyItMatches: rec.reasoning,
        overview: validated.overview || '',
      });
    } else {
      unavailableTitles.push(rec.title);
    }
  });

  console.log('[Recommend] Validated:', recommendations.length, 'available |', unavailableTitles.length, 'unavailable:', unavailableTitles.join(', ') || 'none');

  return {
    recommendations,
    followUpMessage: claudeResult.followUpMessage,
    unavailableTitles,
  };
}
