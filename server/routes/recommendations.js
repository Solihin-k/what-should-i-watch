import { Router } from 'express';
import PLATFORMS from '../config/platforms.js';
import { discoverContent, getGenreList } from '../services/tmdbService.js';

const router = Router();

router.get('/recommendations', async (req, res, next) => {
  try {
    const region = req.query.region || 'SG';
    const platformQuery = req.query.platforms || '';

    const platformIds = platformQuery
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (platformIds.length === 0) {
      return res.json([]);
    }

    // Map platform IDs to TMDB provider IDs
    const providerIds = platformIds
      .map((id) => PLATFORMS.find((p) => p.id === id)?.tmdbProviderId)
      .filter(Boolean);

    if (providerIds.length === 0) {
      return res.json([]);
    }

    // Fetch movies, TV shows, and genre lists in parallel
    const [movies, tvShows, movieGenres, tvGenres] = await Promise.all([
      discoverContent(providerIds, region, 'movie'),
      discoverContent(providerIds, region, 'tv'),
      getGenreList('movie'),
      getGenreList('tv'),
    ]);

    // Interleave movie and TV results (1 movie, 1 TV, …), take top 6 total
    const interleaved = [];
    const maxItems = 6;
    for (let i = 0; interleaved.length < maxItems; i++) {
      if (i < movies.length) interleaved.push({ item: movies[i], mediaType: 'movie' });
      if (interleaved.length >= maxItems) break;
      if (i < tvShows.length) interleaved.push({ item: tvShows[i], mediaType: 'tv' });
    }

    const results = interleaved.map(({ item, mediaType }) => {
      const genreMap = mediaType === 'movie' ? movieGenres : tvGenres;
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

      return {
        id: item.id,
        title: item.title || item.name,
        year,
        mediaType,
        posterPath: item.poster_path || null,
        rating: item.vote_average ?? null,
        genres: (item.genre_ids || []).map((id) => ({ id, name: genreMap[id] || 'Unknown' })),
        overview: item.overview || '',
      };
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
