import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

dotenv.config();

// Genre lists are stable (~20 entries) — cache for 24 hours to avoid redundant calls
const genreCache = new NodeCache({ stdTTL: 86400 });

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
  const response = await tmdbClient.get(`/discover/${mediaType}`, {
    params: {
      watch_region: region,
      with_watch_providers: providerIds.join('|'),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
      page: 1,
    },
  });
  return response.data.results || [];
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

export {
  tmdbClient,
  searchContent,
  getContentDetails,
  getWatchProviders,
  enrichContent,
  discoverContent,
  getGenreList,
};
