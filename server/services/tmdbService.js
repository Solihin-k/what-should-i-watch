import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

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

export { tmdbClient, searchContent, getContentDetails, getWatchProviders, enrichContent };
