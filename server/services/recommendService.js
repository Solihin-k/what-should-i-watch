import PLATFORMS from '../config/platforms.js';
import { getRecommendations, extractUserTags, pickFromCandidates } from './claudeService.js';
import { validateTitle, lookupTitle, discoverDiverseCatalog, getGenreList } from './tmdbService.js';
import { getRedditDb } from './redditDbLoader.js';
import { filterCandidates } from './titleMatcher.js';

// Fisher-Yates in-place shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a concise catalog string from TMDB discover results for Claude's context
async function buildAvailableCatalog(platformProviderIds, region) {
  // Genre lists are cached 24h — always safe to fetch in parallel
  const [movieGenres, tvGenres] = await Promise.all([
    getGenreList('movie'),
    getGenreList('tv'),
  ]);

  // Stagger discover calls to avoid TMDB rate limits on cold cache:
  // movies first (3 TMDB calls), then 250ms delay, then TV (3 TMDB calls)
  const movies = await discoverDiverseCatalog(platformProviderIds, region, 'movie');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const tvShows = await discoverDiverseCatalog(platformProviderIds, region, 'tv');

  const formatEntry = (item, genreMap, mediaType) => {
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date || '';
    const year = date ? new Date(date).getFullYear() : '?';
    const genres = (item.genre_ids || []).map((id) => genreMap[id]).filter(Boolean).join(', ');
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '?';
    const type = mediaType === 'movie' ? 'movie' : 'series';
    return `${title} (${year}) [${type}] - ${genres} - ${rating}/10`;
  };

  const movieEntries = movies.map((m) => formatEntry(m, movieGenres, 'movie'));
  const tvEntries = tvShows.map((t) => formatEntry(t, tvGenres, 'tv'));
  const allEntries = [...movieEntries, ...tvEntries];
  shuffleArray(allEntries);
  const catalog = allEntries.join('\n');

  console.log(`[Recommend] Fetched catalog: ${movieEntries.length} movies + ${tvEntries.length} TV shows`);
  return catalog;
}

// Build a validated recommendation object from TMDB data
function buildRecommendation({ validated, selectedPlatforms, reasoning, source, unverified = false, topComments }) {
  const releaseDate = validated.release_date || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  const matchedPlatformObjects = unverified
    ? selectedPlatforms.filter((p) => p.unverified)
    : validated.matchedPlatforms
        .map((provider) => selectedPlatforms.find((p) => p.tmdbProviderId === provider.provider_id))
        .filter(Boolean);

  return {
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
    whyItMatches: reasoning,
    overview: validated.overview || '',
    source,
    ...(unverified && { unverified: true }),
    ...(topComments && topComments.length > 0 && { topComments }),
  };
}

// Validate picks against TMDB, returning validated recommendations
async function validatePicks({ picks, region, platformProviderIds, selectedPlatforms, source, candidates = [] }) {
  const recommendations = [];
  const unavailableTitles = [];

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    try {
      const result = await validateTitle({
        title: pick.title,
        year: pick.year,
        type: pick.type,
        region,
        platformProviderIds,
      });

      if (result) {
        const matchedCandidate = candidates.find((c) => c.title.toLowerCase() === pick.title.toLowerCase());
        recommendations.push(buildRecommendation({
          validated: result,
          selectedPlatforms,
          reasoning: pick.reasoning,
          source,
          topComments: matchedCandidate?.topComments,
        }));
      } else {
        unavailableTitles.push(pick);
      }
    } catch (err) {
      console.error('[Recommend] TMDB lookup failed for', pick.title, ':', err.message);
      unavailableTitles.push(pick);
    }
    if (i < picks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { recommendations, unavailableTitles };
}

// Recover unavailable titles for unverified platforms (e.g. Viki)
async function recoverUnverified({ unavailableTitles, selectedPlatforms, region, source }) {
  const unverifiedPlatforms = selectedPlatforms.filter((p) => p.unverified);
  if (unverifiedPlatforms.length === 0 || unavailableTitles.length === 0) return [];

  const recovered = [];
  for (const pick of unavailableTitles) {
    try {
      const looked = await lookupTitle({
        title: pick.title,
        year: pick.year,
        type: pick.type,
        region,
      });
      if (looked) {
        recovered.push(buildRecommendation({
          validated: looked,
          selectedPlatforms,
          reasoning: pick.reasoning,
          source,
          unverified: true,
        }));
      }
    } catch (err) {
      console.error('[Recommend] Fallback lookup failed for', pick.title, ':', err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (recovered.length > 0) {
    console.log('[Recommend] Recovered', recovered.length, 'titles via unverified fallback');
  }
  return recovered;
}

export async function generateGuidedRecommendations({ tags, platforms, region }) {
  const selectedPlatforms = platforms
    .map((id) => PLATFORMS.find((p) => p.id === id))
    .filter(Boolean);

  const platformProviderIds = selectedPlatforms.map((p) => p.tmdbProviderId);

  // Build a synthetic message from structured tags for Claude's context
  const parts = [];
  if (tags.moods?.length) parts.push(`something ${tags.moods.join('/')} in mood`);
  if (tags.genres?.length) parts.push(`in the ${tags.genres.join(', ')} genre(s)`);
  if (tags.bestFor?.length) parts.push(`good for ${tags.bestFor.join(', ')}`);
  if (tags.contentType === 'series') {
    parts.push('only TV series (no movies)');
  } else if (tags.contentType === 'movie') {
    parts.push('movies only (no TV series)');
  } else if (tags.timeCommitment) {
    parts.push(tags.timeCommitment === 'short' ? 'movie-length or short episodes' : 'TV series to binge');
  }
  if (tags.language) {
    const lang = Array.isArray(tags.language) ? tags.language.join('/') : tags.language;
    parts.push(`in ${lang}`);
  }
  if (tags.boostHiddenGem) parts.push('preferably hidden gems or lesser-known titles');
  const syntheticMessage = parts.length > 0
    ? `I want to watch ${parts.join(', ')}`
    : 'Recommend me something good to watch';

  console.log('[Recommend:Guided] Synthetic message:', syntheticMessage);

  // Load Reddit DB
  const redditDb = getRedditDb();

  // Apply hidden gem boost if requested
  const extractedTags = { ...tags };
  let candidateDb = redditDb;
  if (tags.boostHiddenGem && redditDb.length > 0) {
    candidateDb = redditDb.map((title) =>
      title.hiddenGem ? { ...title, _hiddenGemBoost: true } : title
    );
  }

  if (candidateDb.length > 0) {
    console.log('[Recommend:Guided] Using Reddit-curated path with', candidateDb.length, 'titles');

    const candidates = filterCandidates({ redditDb: candidateDb, extractedTags, region });

    // Apply extra hidden gem boost in scoring
    const boostedCandidates = tags.boostHiddenGem
      ? candidates.map((c) => c._hiddenGemBoost ? { ...c, _score: (c._score || 0) + 5 } : c)
          .sort((a, b) => b._score - a._score)
      : candidates;

    console.log('[Recommend:Guided] Filtered to', boostedCandidates.length, 'candidates');

    if (boostedCandidates.length > 0) {
      const pickResult = await pickFromCandidates({
        message: syntheticMessage,
        candidates: boostedCandidates,
        platforms: selectedPlatforms,
        region,
        conversationHistory: [],
      });

      if (pickResult.picks.length === 0) {
        return {
          recommendations: [],
          followUpMessage: pickResult.followUpMessage,
        };
      }

      console.log('[Recommend:Guided] Claude picked', pickResult.picks.length, 'titles');

      const { recommendations: communityRecs, unavailableTitles } = await validatePicks({
        picks: pickResult.picks,
        region,
        platformProviderIds,
        selectedPlatforms,
        source: 'community',
        candidates: boostedCandidates || candidates,
      });

      const recoveredRecs = await recoverUnverified({
        unavailableTitles,
        selectedPlatforms,
        region,
        source: 'community',
      });

      const allCommunityRecs = [...communityRecs, ...recoveredRecs];

      if (allCommunityRecs.length >= 3) {
        return {
          recommendations: allCommunityRecs.slice(0, 3),
          followUpMessage: pickResult.followUpMessage,
        };
      }

      // Fill remaining from TMDB fallback
      const needed = 3 - allCommunityRecs.length;
      const tmdbResult = await tmdbFallbackPath({
        message: syntheticMessage,
        selectedPlatforms,
        platformProviderIds,
        region,
        conversationHistory: [],
        excludeTitles: allCommunityRecs.map((r) => r.title),
      });

      return {
        recommendations: [...allCommunityRecs, ...tmdbResult.recommendations.slice(0, needed)].slice(0, 3),
        followUpMessage: pickResult.followUpMessage,
      };
    }
  }

  // Fallback to TMDB path
  console.log('[Recommend:Guided] Using TMDB fallback path');
  return tmdbFallbackPath({
    message: syntheticMessage,
    selectedPlatforms,
    platformProviderIds,
    region,
    conversationHistory: [],
  });
}

export async function generateRecommendations({ message, platforms, region, conversationHistory = [] }) {
  const selectedPlatforms = platforms
    .map((id) => PLATFORMS.find((p) => p.id === id))
    .filter(Boolean);

  const platformProviderIds = selectedPlatforms.map((p) => p.tmdbProviderId);

  // Step 1: Load Reddit DB
  const redditDb = getRedditDb();
  const useRedditPath = redditDb.length > 0;

  if (useRedditPath) {
    console.log('[Recommend] Using Reddit-curated path with', redditDb.length, 'titles');

    // Step 2: Extract tags (Claude #1)
    const extractedTags = await extractUserTags({ message, conversationHistory });
    console.log('[Recommend] Extracted tags:', JSON.stringify(extractedTags));

    // Step 3: Filter candidates
    const candidates = filterCandidates({ redditDb, extractedTags, region });
    console.log('[Recommend] Filtered to', candidates.length, 'candidates');

    if (candidates.length > 0) {
      // Step 4: Pick from candidates (Claude #2)
      const pickResult = await pickFromCandidates({
        message,
        candidates,
        platforms: selectedPlatforms,
        region,
        conversationHistory,
      });

      // Clarifying question — pass through
      if (pickResult.picks.length === 0) {
        return {
          recommendations: [],
          followUpMessage: pickResult.followUpMessage,
        };
      }

      console.log('[Recommend] Claude picked', pickResult.picks.length, 'titles');

      // Step 5: Validate picks against TMDB
      const { recommendations: communityRecs, unavailableTitles } = await validatePicks({
        picks: pickResult.picks,
        region,
        platformProviderIds,
        selectedPlatforms,
        source: 'community',
        candidates,
      });

      // Recover unavailable via unverified platforms
      const recoveredRecs = await recoverUnverified({
        unavailableTitles,
        selectedPlatforms,
        region,
        source: 'community',
      });

      const allCommunityRecs = [...communityRecs, ...recoveredRecs];
      console.log('[Recommend] Community validated:', allCommunityRecs.length, '| unavailable:', unavailableTitles.length - recoveredRecs.length);

      // Step 6: Fallback if < 3 validated
      if (allCommunityRecs.length >= 3) {
        return {
          recommendations: allCommunityRecs.slice(0, 3),
          followUpMessage: pickResult.followUpMessage,
        };
      }

      console.log('[Recommend] Only', allCommunityRecs.length, 'community recs, falling back to TMDB');

      // Fill remaining slots from TMDB path
      const needed = 3 - allCommunityRecs.length;
      const tmdbResult = await tmdbFallbackPath({
        message,
        selectedPlatforms,
        platformProviderIds,
        region,
        conversationHistory,
        excludeTitles: allCommunityRecs.map((r) => r.title),
      });

      const finalRecs = [...allCommunityRecs, ...tmdbResult.recommendations.slice(0, needed)];
      return {
        recommendations: finalRecs.slice(0, 3),
        followUpMessage: pickResult.followUpMessage,
        unavailableTitles: unavailableTitles
          .filter((t) => !recoveredRecs.some((r) => r.title === t.title))
          .map((t) => t.title),
      };
    }
  }

  // No Reddit DB or no candidates — full TMDB fallback
  console.log('[Recommend] Using TMDB fallback path');
  const result = await tmdbFallbackPath({ message, selectedPlatforms, platformProviderIds, region, conversationHistory });
  return result;
}

// Original TMDB-based recommendation flow
async function tmdbFallbackPath({ message, selectedPlatforms, platformProviderIds, region, conversationHistory, excludeTitles = [] }) {
  let availableCatalog = '';
  try {
    availableCatalog = await buildAvailableCatalog(platformProviderIds, region);
  } catch (err) {
    console.error('[Recommend] Failed to fetch catalog, proceeding without:', err.message);
  }

  console.log('[Recommend] Calling Claude for:', message.substring(0, 80), '| Platforms:', selectedPlatforms.map((p) => p.id).join(', '));
  let claudeResult;
  try {
    claudeResult = await getRecommendations({
      message,
      platforms: selectedPlatforms,
      region,
      conversationHistory,
      availableCatalog,
      unavailableTitles: excludeTitles,
    });
    console.log('[Recommend] Claude returned', claudeResult.recommendations.length, 'recommendations');
  } catch (err) {
    console.error('[Recommend] Claude service failed entirely:', err.message);
    return {
      recommendations: [],
      followUpMessage: "I'm having trouble connecting right now. Please try again in a moment.",
    };
  }

  if (claudeResult.recommendations.length === 0) {
    return {
      recommendations: [],
      followUpMessage: claudeResult.followUpMessage,
      ...(claudeResult.retryable && { retryable: true }),
    };
  }

  // Validate against TMDB
  const { recommendations, unavailableTitles } = await validatePicks({
    picks: claudeResult.recommendations,
    region,
    platformProviderIds,
    selectedPlatforms,
    source: 'popular',
  });

  // Recover via unverified platforms
  const recoveredRecs = await recoverUnverified({
    unavailableTitles: unavailableTitles.map((t) => {
      const orig = claudeResult.recommendations.find((r) => r.title === t.title);
      return orig || t;
    }),
    selectedPlatforms,
    region,
    source: 'popular',
  });

  const allRecs = [...recommendations, ...recoveredRecs];
  const finalRecommendations = allRecs.slice(0, 3);

  return {
    recommendations: finalRecommendations,
    followUpMessage: claudeResult.followUpMessage,
    unavailableTitles: unavailableTitles
      .filter((t) => !recoveredRecs.some((r) => r.title === (t.title || t)))
      .map((t) => t.title || t),
  };
}
