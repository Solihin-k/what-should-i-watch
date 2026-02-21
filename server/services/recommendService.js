import PLATFORMS from '../config/platforms.js';
import { getRecommendations } from './claudeService.js';
import { validateTitle, lookupTitle } from './tmdbService.js';

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

  // If Claude returned a clarifying question or fallback (0 recommendations), pass it through
  if (claudeResult.recommendations.length === 0) {
    return {
      recommendations: [],
      followUpMessage: claudeResult.followUpMessage,
      ...(claudeResult.retryable && { retryable: true }),
    };
  }

  // Validate each recommendation against TMDB sequentially with delay to avoid rate limits
  const validationResults = [];
  for (let i = 0; i < claudeResult.recommendations.length; i++) {
    const rec = claudeResult.recommendations[i];
    try {
      const result = await validateTitle({
        title: rec.title,
        year: rec.year,
        type: rec.type,
        region,
        platformProviderIds,
      });
      validationResults.push({ status: 'fulfilled', value: result });
    } catch (err) {
      console.error('[Recommend] TMDB lookup failed for', rec.title, ':', err.message);
      validationResults.push({ status: 'rejected', reason: err });
    }
    // Rate limit: 200ms between TMDB requests
    if (i < claudeResult.recommendations.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

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

  // Fallback: recover unavailable titles for unverified platforms (e.g. Viki)
  const unverifiedPlatforms = selectedPlatforms.filter((p) => p.unverified);
  if (unverifiedPlatforms.length > 0 && unavailableTitles.length > 0) {
    const recoveredTitles = [];
    for (const titleName of [...unavailableTitles]) {
      const originalRec = claudeResult.recommendations.find((r) => r.title === titleName);
      if (!originalRec) continue;
      try {
        const looked = await lookupTitle({
          title: originalRec.title,
          year: originalRec.year,
          type: originalRec.type,
          region,
        });
        if (looked) {
          const releaseDate = looked.release_date || '';
          const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
          recommendations.push({
            id: looked.id,
            title: looked.title,
            year,
            mediaType: looked.mediaType,
            posterPath: looked.poster_path || null,
            rating: looked.vote_average ?? null,
            genres: (looked.genres || []).map((g) => ({ id: g.id, name: g.name })),
            platforms: unverifiedPlatforms.map((p) => ({
              id: p.id,
              name: p.name,
              brandColor: p.brandColor,
            })),
            whyItMatches: originalRec.reasoning,
            overview: looked.overview || '',
            unverified: true,
          });
          recoveredTitles.push(titleName);
        }
      } catch (err) {
        console.error('[Recommend] Fallback lookup failed for', titleName, ':', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    for (const t of recoveredTitles) {
      const idx = unavailableTitles.indexOf(t);
      if (idx !== -1) unavailableTitles.splice(idx, 1);
    }
    console.log('[Recommend] Recovered', recoveredTitles.length, 'titles via unverified fallback');
  }

  const finalRecommendations = recommendations.slice(0, 3);

  return {
    recommendations: finalRecommendations,
    followUpMessage: claudeResult.followUpMessage,
    unavailableTitles,
  };
}
