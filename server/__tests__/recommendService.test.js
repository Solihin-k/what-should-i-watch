import { jest } from '@jest/globals';

const mockGetRecommendations = jest.fn();
const mockValidateTitle = jest.fn();
const mockLookupTitle = jest.fn();
const mockDiscoverDiverseCatalog = jest.fn();
const mockGetGenreList = jest.fn();

jest.unstable_mockModule('../services/claudeService.js', () => ({
  getRecommendations: mockGetRecommendations,
}));

jest.unstable_mockModule('../services/tmdbService.js', () => ({
  validateTitle: mockValidateTitle,
  lookupTitle: mockLookupTitle,
  discoverDiverseCatalog: mockDiscoverDiverseCatalog,
  getGenreList: mockGetGenreList,
}));

// platforms.js is not mocked — uses real platform data
const { generateRecommendations } = await import('../services/recommendService.js');

beforeEach(() => {
  mockGetRecommendations.mockReset();
  mockValidateTitle.mockReset();
  mockLookupTitle.mockReset();
  mockDiscoverDiverseCatalog.mockReset();
  mockGetGenreList.mockReset();

  // Default: discover returns empty catalog, genre maps are empty
  mockDiscoverDiverseCatalog.mockResolvedValue([]);
  mockGetGenreList.mockResolvedValue({});
});

describe('generateRecommendations', () => {
  const baseParams = {
    message: 'funny movies',
    platforms: ['netflix'],
    region: 'SG',
    conversationHistory: [],
  };

  it('returns validated recommendations (happy path)', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', reasoning: 'Witty' },
        { title: 'Parasite', year: 2019, type: 'movie', reasoning: 'Thrilling' },
      ],
      followUpMessage: 'Enjoy!',
    });

    mockValidateTitle.mockResolvedValue({
      id: 100,
      title: 'The Grand Budapest Hotel',
      poster_path: '/poster.jpg',
      vote_average: 8.1,
      genres: [{ id: 35, name: 'Comedy' }],
      release_date: '2014-03-28',
      overview: 'A funny movie.',
      mediaType: 'movie',
      matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
    });

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
    expect(result.recommendations[0].platforms).toHaveLength(1);
    expect(result.recommendations[0].platforms[0].name).toBe('Netflix');
    expect(result.followUpMessage).toBe('Enjoy!');
  });

  it('pre-fetches diverse catalog and passes it to Claude', async () => {
    mockDiscoverDiverseCatalog.mockImplementation((_ids, _region, mediaType) => {
      if (mediaType === 'movie') {
        return Promise.resolve([
          { title: 'Funny Movie', release_date: '2023-06-01', genre_ids: [35], vote_average: 7.5 },
        ]);
      }
      return Promise.resolve([
        { name: 'Comedy Show', first_air_date: '2022-01-01', genre_ids: [35], vote_average: 8.0 },
      ]);
    });
    mockGetGenreList.mockResolvedValue({ 35: 'Comedy' });

    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Funny Movie', year: 2023, type: 'movie', reasoning: 'Hilarious' },
        { title: 'Comedy Show', year: 2022, type: 'series', reasoning: 'Great laughs' },
        { title: 'Another Comedy', year: 2021, type: 'movie', reasoning: 'Classic humor' },
      ],
      followUpMessage: 'Enjoy these comedies!',
    });

    mockValidateTitle.mockResolvedValue({
      id: 200,
      title: 'Funny Movie',
      poster_path: '/funny.jpg',
      vote_average: 7.5,
      genres: [{ id: 35, name: 'Comedy' }],
      release_date: '2023-06-01',
      overview: '',
      mediaType: 'movie',
      matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
    });

    const result = await generateRecommendations(baseParams);

    // Verify discoverDiverseCatalog was called for both movie and tv
    expect(mockDiscoverDiverseCatalog).toHaveBeenCalledTimes(2);
    expect(mockGetGenreList).toHaveBeenCalledTimes(2);

    // Verify catalog was passed to Claude
    const claudeCall = mockGetRecommendations.mock.calls[0][0];
    expect(claudeCall.availableCatalog).toContain('Funny Movie (2023)');
    expect(claudeCall.availableCatalog).toContain('Comedy Show (2022)');

    expect(result.recommendations).toHaveLength(3);
  });

  it('shuffles catalog entries before passing to Claude', async () => {
    // Create enough entries to make shuffle detectable
    const movies = Array.from({ length: 20 }, (_, i) => ({
      title: `Movie ${i}`,
      release_date: '2023-01-01',
      genre_ids: [28],
      vote_average: 7.0,
    }));
    const tvShows = Array.from({ length: 20 }, (_, i) => ({
      name: `Show ${i}`,
      first_air_date: '2023-01-01',
      genre_ids: [18],
      vote_average: 7.0,
    }));

    mockDiscoverDiverseCatalog.mockImplementation((_ids, _region, mediaType) => {
      return Promise.resolve(mediaType === 'movie' ? movies : tvShows);
    });
    mockGetGenreList.mockResolvedValue({ 28: 'Action', 18: 'Drama' });

    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [],
      followUpMessage: 'What genre?',
    });

    await generateRecommendations(baseParams);

    const claudeCall = mockGetRecommendations.mock.calls[0][0];
    const lines = claudeCall.availableCatalog.split('\n');

    // With 40 entries, the chance that all movies come before all shows after shuffle is negligible
    // Check that the entries are not perfectly ordered (all movies then all shows)
    const firstShowIndex = lines.findIndex((l) => l.includes('[series]'));
    const lastMovieIndex = lines.length - 1 - [...lines].reverse().findIndex((l) => l.includes('[movie]'));

    // After shuffle, at least some shows should appear before the last movie
    expect(firstShowIndex).toBeLessThan(lastMovieIndex);
  });

  it('handles partial availability — some titles unavailable', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Available Movie', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Unavailable Movie', year: 2023, type: 'movie', reasoning: 'Also good' },
      ],
      followUpMessage: 'Here are some picks!',
    });

    // First call succeeds, second returns null (unavailable)
    mockValidateTitle
      .mockResolvedValueOnce({
        id: 200,
        title: 'Available Movie',
        poster_path: '/avail.jpg',
        vote_average: 7.5,
        genres: [],
        release_date: '2023-06-01',
        overview: '',
        mediaType: 'movie',
        matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
      })
      .mockResolvedValueOnce(null);

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(1);
    expect(result.unavailableTitles).toContain('Unavailable Movie');
  });

  it('returns clarifying question when Claude gives 0 recommendations', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [],
      followUpMessage: 'What genre are you in the mood for?',
    });

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toBe('What genre are you in the mood for?');
    expect(result.retryable).toBeUndefined();
    // validateTitle should not be called when there are no recommendations
    expect(mockValidateTitle).not.toHaveBeenCalled();
  });

  it('passes through retryable flag when Claude parse failed', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [],
      followUpMessage: 'Some raw text fallback',
      retryable: true,
    });

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.retryable).toBe(true);
  });

  it('handles Promise.allSettled resilience — rejected validations are skipped', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Good Movie', year: 2023, type: 'movie', reasoning: 'Nice' },
        { title: 'Error Movie', year: 2023, type: 'movie', reasoning: 'Also nice' },
      ],
      followUpMessage: 'Options!',
    });

    mockValidateTitle
      .mockResolvedValueOnce({
        id: 300,
        title: 'Good Movie',
        poster_path: '/good.jpg',
        vote_average: 8.0,
        genres: [],
        release_date: '2023-01-01',
        overview: '',
        mediaType: 'movie',
        matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
      })
      .mockRejectedValueOnce(new Error('TMDB API error'));

    const result = await generateRecommendations(baseParams);

    // Only the successful validation should appear
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe('Good Movie');
    expect(result.unavailableTitles).toContain('Error Movie');
  });

  it('returns graceful fallback if Claude call fails entirely', async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toContain('trouble');
  });

  it('proceeds without catalog if diverse discover fails', async () => {
    mockDiscoverDiverseCatalog.mockRejectedValue(new Error('TMDB rate limited'));

    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Some Movie', year: 2023, type: 'movie', reasoning: 'Good pick' },
      ],
      followUpMessage: 'Here you go!',
    });

    mockValidateTitle.mockResolvedValueOnce({
      id: 400,
      title: 'Some Movie',
      poster_path: '/some.jpg',
      vote_average: 7.0,
      genres: [],
      release_date: '2023-01-01',
      overview: '',
      mediaType: 'movie',
      matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
    });

    const result = await generateRecommendations(baseParams);

    // Should still work, just without catalog context
    expect(result.recommendations).toHaveLength(1);
    const claudeCall = mockGetRecommendations.mock.calls[0][0];
    expect(claudeCall.availableCatalog).toBe('');
  });
});
