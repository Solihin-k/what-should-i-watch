import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

dotenv.config();

// Genre lists are stable (~20 entries) — cache for 24 hours to avoid redundant calls
const genreCache = new NodeCache({ stdTTL: 86400 });

// Discover results cache — 6 hour TTL, avoids redundant TMDB calls for same platform+region combo
const discoverCache = new NodeCache({ stdTTL: 21600 });

const tmdbClient = axios.create({
  baseURL: process.env.TMDB_API_BASE_URL,
  params: {
    api_key: process.env.TMDB_API_KEY,
  },
});

async function searchContent(query) {
  const response = await tmdbClient.get('/search/multi', {
    params: { query },
  });
  // Filter out persons — we only want movies and TV shows
  return (response.data.results || []).filter((item) => item.media_type !== 'person');
}

async function getContentDetails(tmdbId, mediaType) {
  const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const response = await tmdbClient.get(endpoint);
  const data = response.data;

  return {
    id: data.id,
    title: data.title || data.name,
    overview: data.overview,
    poster_path: data.poster_path,
    vote_average: data.vote_average,
    genres: data.genres,
    release_date: data.release_date || data.first_air_date,
    // TV shows return episode_run_time as array; take first value
    runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || null,
  };
}

async function getWatchProviders(tmdbId, mediaType, region) {
  const endpoint =
    mediaType === 'movie'
      ? `/movie/${tmdbId}/watch/providers`
      : `/tv/${tmdbId}/watch/providers`;

  const response = await tmdbClient.get(endpoint);
  const regionData = response.data.results?.[region];

  if (!regionData) {
    return [];
  }

  // Only return subscription (flatrate) providers — not rent/buy
  return regionData.flatrate || [];
}

async function enrichContent(tmdbId, mediaType, region) {
  const [details, providers] = await Promise.all([
    getContentDetails(tmdbId, mediaType),
    getWatchProviders(tmdbId, mediaType, region),
  ]);

  return { ...details, providers };
}

// discoverContent — fetches popular subscription content from TMDB for given provider IDs
// providerIds: array of TMDB provider IDs; region: ISO 3166-1 alpha-2; mediaType: 'movie' | 'tv'
async function discoverContent(providerIds, region, mediaType) {
  const sortedIds = [...providerIds].sort((a, b) => a - b);
  const cacheKey = `${sortedIds.join(',')}_${region}_${mediaType}`;
  const cached = discoverCache.get(cacheKey);
  if (cached) return cached;

  const response = await tmdbClient.get(`/discover/${mediaType}`, {
    params: {
      watch_region: region,
      with_watch_providers: providerIds.join('|'),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
      page: 1,
    },
  });
  const results = response.data.results || [];
  discoverCache.set(cacheKey, results);
  return results;
}

// getGenreList — returns a map of { [genreId]: genreName } for fast lookup
// Results are cached for 24 hours as the genre list rarely changes
async function getGenreList(mediaType) {
  const cacheKey = `genres_${mediaType}`;
  const cached = genreCache.get(cacheKey);
  if (cached) return cached;

  const response = await tmdbClient.get(`/genre/${mediaType}/list`);
  const genreMap = Object.fromEntries(
    (response.data.genres || []).map((g) => [g.id, g.name])
  );
  genreCache.set(cacheKey, genreMap);
  return genreMap;
}

// validateTitle — checks if a Claude-suggested title exists on TMDB and is available on the user's platforms
// Returns enriched content with matchedPlatforms, or null if not found/unavailable
async function validateTitle({ title, year, type, region, platformProviderIds }) {
  const mediaType = type === 'series' ? 'tv' : 'movie';

  const response = await tmdbClient.get(`/search/${mediaType}`, {
    params: { query: title },
  });

  const results = response.data.results || [];
  if (results.length === 0) return null;

  // Find best match — filter by year (+/- 1 tolerance) if provided
  const match = results.find((item) => {
    if (!year) return true;
    const releaseDate = item.release_date || item.first_air_date || '';
    if (!releaseDate) return true;
    const itemYear = new Date(releaseDate).getFullYear();
    return Math.abs(itemYear - year) <= 1;
  }) || results[0]; // Fall back to top result if no year match

  const enriched = await enrichContent(match.id, mediaType, region);

  // Check if any of the content's providers match the user's selected platforms
  const matchedPlatforms = (enriched.providers || []).filter((p) =>
    platformProviderIds.includes(p.provider_id)
  );

  if (matchedPlatforms.length === 0) return null;

  return { ...enriched, mediaType, matchedPlatforms };
}

// lookupTitle — searches TMDB and enriches content without checking platform availability
// Used as fallback for unverified platforms (e.g. Viki) where TMDB has no provider data
async function lookupTitle({ title, year, type, region }) {
  const mediaType = type === 'series' ? 'tv' : 'movie';

  const response = await tmdbClient.get(`/search/${mediaType}`, {
    params: { query: title },
  });

  const results = response.data.results || [];
  if (results.length === 0) return null;

  const match = results.find((item) => {
    if (!year) return true;
    const releaseDate = item.release_date || item.first_air_date || '';
    if (!releaseDate) return true;
    return Math.abs(new Date(releaseDate).getFullYear() - year) <= 1;
  }) || results[0];

  const enriched = await enrichContent(match.id, mediaType, region);
  return { ...enriched, mediaType };
}

// discoverDiverseCatalog — fetches 3 diverse pages of content per media type and deduplicates
// Page 1: most popular; Page 2: top-rated (vote_count >= 50); Page 3: random deeper page (2-6) of popular
async function discoverDiverseCatalog(providerIds, region, mediaType) {
  const sortedIds = [...providerIds].sort((a, b) => a - b);
  const cacheKey = `diverse_${sortedIds.join(',')}_${region}_${mediaType}`;
  const cached = discoverCache.get(cacheKey);
  if (cached) return cached;

  const baseParams = {
    watch_region: region,
    with_watch_providers: providerIds.join('|'),
    with_watch_monetization_types: 'flatrate',
  };

  const randomPage = Math.floor(Math.random() * 5) + 2; // 2-6

  const [popularPage, topRatedPage, deeperPage] = await Promise.all([
    tmdbClient.get(`/discover/${mediaType}`, {
      params: { ...baseParams, sort_by: 'popularity.desc', page: 1 },
    }),
    tmdbClient.get(`/discover/${mediaType}`, {
      params: { ...baseParams, sort_by: 'vote_average.desc', 'vote_count.gte': 50, page: 1 },
    }),
    tmdbClient.get(`/discover/${mediaType}`, {
      params: { ...baseParams, sort_by: 'popularity.desc', page: randomPage },
    }),
  ]);

  const allResults = [
    ...(popularPage.data.results || []),
    ...(topRatedPage.data.results || []),
    ...(deeperPage.data.results || []),
  ];

  // Deduplicate by id — keep first occurrence
  const seen = new Set();
  const deduplicated = allResults.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  discoverCache.set(cacheKey, deduplicated);
  return deduplicated;
}

export {
  tmdbClient,
  searchContent,
  getContentDetails,
  getWatchProviders,
  enrichContent,
  discoverContent,
  discoverDiverseCatalog,
  getGenreList,
  validateTitle,
  lookupTitle,
};
