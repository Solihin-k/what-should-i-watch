import { jest } from '@jest/globals';

const mockGetRecommendations = jest.fn();
const mockExtractUserTags = jest.fn();
const mockPickFromCandidates = jest.fn();
const mockValidateTitle = jest.fn();
const mockLookupTitle = jest.fn();
const mockDiscoverDiverseCatalog = jest.fn();
const mockGetGenreList = jest.fn();
const mockGetRedditDb = jest.fn();
const mockFilterCandidates = jest.fn();

jest.unstable_mockModule('../services/claudeService.js', () => ({
  getRecommendations: mockGetRecommendations,
  extractUserTags: mockExtractUserTags,
  pickFromCandidates: mockPickFromCandidates,
}));

jest.unstable_mockModule('../services/tmdbService.js', () => ({
  validateTitle: mockValidateTitle,
  lookupTitle: mockLookupTitle,
  discoverDiverseCatalog: mockDiscoverDiverseCatalog,
  getGenreList: mockGetGenreList,
}));

jest.unstable_mockModule('../services/redditDbLoader.js', () => ({
  getRedditDb: mockGetRedditDb,
}));

jest.unstable_mockModule('../services/titleMatcher.js', () => ({
  filterCandidates: mockFilterCandidates,
}));

// platforms.js is not mocked — uses real platform data
const { generateRecommendations } = await import('../services/recommendService.js');

beforeEach(() => {
  mockGetRecommendations.mockReset();
  mockExtractUserTags.mockReset();
  mockPickFromCandidates.mockReset();
  mockValidateTitle.mockReset();
  mockLookupTitle.mockReset();
  mockDiscoverDiverseCatalog.mockReset();
  mockGetGenreList.mockReset();
  mockGetRedditDb.mockReset();
  mockFilterCandidates.mockReset();

  // Default: empty Reddit DB (TMDB fallback), discover returns empty catalog
  mockGetRedditDb.mockReturnValue([]);
  mockDiscoverDiverseCatalog.mockResolvedValue([]);
  mockGetGenreList.mockResolvedValue({});
});

function makeValidated(title, overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    title,
    poster_path: '/poster.jpg',
    vote_average: 8.0,
    genres: [{ id: 35, name: 'Comedy' }],
    release_date: '2023-06-01',
    overview: 'A great movie.',
    mediaType: 'movie',
    matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }],
    ...overrides,
  };
}

describe('generateRecommendations — TMDB fallback path (empty Reddit DB)', () => {
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

    mockValidateTitle.mockResolvedValue(makeValidated('The Grand Budapest Hotel'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
    expect(result.recommendations[0].source).toBe('popular');
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

    mockValidateTitle.mockResolvedValue(makeValidated('Funny Movie'));

    const result = await generateRecommendations(baseParams);

    expect(mockDiscoverDiverseCatalog).toHaveBeenCalledTimes(2);
    expect(mockGetGenreList).toHaveBeenCalledTimes(2);

    const claudeCall = mockGetRecommendations.mock.calls[0][0];
    expect(claudeCall.availableCatalog).toContain('Funny Movie (2023)');
    expect(claudeCall.availableCatalog).toContain('Comedy Show (2022)');

    expect(result.recommendations).toHaveLength(3);
  });

  it('handles partial availability — some titles unavailable', async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Available Movie', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Unavailable Movie', year: 2023, type: 'movie', reasoning: 'Also good' },
      ],
      followUpMessage: 'Here are some picks!',
    });

    mockValidateTitle
      .mockResolvedValueOnce(makeValidated('Available Movie'))
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

    mockValidateTitle.mockResolvedValueOnce(makeValidated('Some Movie'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(1);
    const claudeCall = mockGetRecommendations.mock.calls[0][0];
    expect(claudeCall.availableCatalog).toBe('');
  });
});

describe('generateRecommendations — Reddit community path', () => {
  const baseParams = {
    message: 'something comforting',
    platforms: ['netflix'],
    region: 'SG',
    conversationHistory: [],
  };

  const redditDb = [
    { title: 'Comfort Movie', year: 2023, type: 'movie', moods: ['comfort'], genres: ['drama'] },
  ];

  beforeEach(() => {
    mockGetRedditDb.mockReturnValue(redditDb);
    mockExtractUserTags.mockResolvedValue({
      moods: ['comfort'],
      genres: ['drama'],
      bestFor: [],
      language: null,
      timeCommitment: null,
    });
    mockFilterCandidates.mockReturnValue(redditDb);
  });

  it('happy path — all community picks validate (source: community)', async () => {
    mockPickFromCandidates.mockResolvedValueOnce({
      picks: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Cozy' },
        { title: 'Movie B', year: 2022, type: 'movie', reasoning: 'Warm' },
        { title: 'Movie C', year: 2021, type: 'movie', reasoning: 'Gentle' },
        { title: 'Movie D', year: 2020, type: 'movie', reasoning: 'Nice' },
        { title: 'Movie E', year: 2019, type: 'movie', reasoning: 'Sweet' },
        { title: 'Movie F', year: 2018, type: 'movie', reasoning: 'Calm' },
      ],
      followUpMessage: 'Cozy picks!',
    });

    mockValidateTitle.mockResolvedValue(makeValidated('Movie A'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].source).toBe('community');
    expect(result.followUpMessage).toBe('Cozy picks!');
    // Should NOT fall back to TMDB
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it('partial community + popular fallback', async () => {
    mockPickFromCandidates.mockResolvedValueOnce({
      picks: [
        { title: 'Community A', year: 2023, type: 'movie', reasoning: 'Cozy' },
        { title: 'Community B', year: 2022, type: 'movie', reasoning: 'Warm' },
      ],
      followUpMessage: 'Some picks!',
    });

    // Only first validates, second fails
    mockValidateTitle
      .mockResolvedValueOnce(makeValidated('Community A'))
      .mockResolvedValueOnce(null)
      // TMDB fallback validates
      .mockResolvedValueOnce(makeValidated('Popular A', { matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }] }))
      .mockResolvedValueOnce(makeValidated('Popular B', { matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }] }))
      .mockResolvedValueOnce(makeValidated('Popular C', { matchedPlatforms: [{ provider_id: 8, provider_name: 'Netflix' }] }));

    // TMDB fallback
    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'Popular A', year: 2023, type: 'movie', reasoning: 'Trending' },
        { title: 'Popular B', year: 2023, type: 'movie', reasoning: 'Hot' },
        { title: 'Popular C', year: 2023, type: 'movie', reasoning: 'Top' },
      ],
      followUpMessage: 'More picks!',
    });

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    // First should be community
    expect(result.recommendations[0].source).toBe('community');
    // TMDB fallback was triggered
    expect(mockGetRecommendations).toHaveBeenCalled();
  });

  it('empty DB falls through to TMDB-only', async () => {
    mockGetRedditDb.mockReturnValue([]);

    mockGetRecommendations.mockResolvedValueOnce({
      recommendations: [
        { title: 'TMDB Movie', year: 2023, type: 'movie', reasoning: 'Popular' },
      ],
      followUpMessage: 'Here!',
    });

    mockValidateTitle.mockResolvedValueOnce(makeValidated('TMDB Movie'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].source).toBe('popular');
    expect(mockExtractUserTags).not.toHaveBeenCalled();
  });

  it('tag extraction failure still proceeds (empty tags → low scores)', async () => {
    mockExtractUserTags.mockResolvedValue({
      moods: [],
      genres: [],
      bestFor: [],
      language: null,
      timeCommitment: null,
    });

    // filterCandidates still returns something (all get hiddenGem/base scores)
    mockFilterCandidates.mockReturnValue(redditDb);

    mockPickFromCandidates.mockResolvedValueOnce({
      picks: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Random' },
        { title: 'Movie B', year: 2022, type: 'movie', reasoning: 'Also random' },
        { title: 'Movie C', year: 2021, type: 'movie', reasoning: 'Another' },
      ],
      followUpMessage: 'Here are some!',
    });

    mockValidateTitle.mockResolvedValue(makeValidated('Movie A'));

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(3);
    expect(mockExtractUserTags).toHaveBeenCalled();
  });

  it('clarifying question from pick step passes through', async () => {
    mockPickFromCandidates.mockResolvedValueOnce({
      picks: [],
      followUpMessage: 'Could you be more specific about what mood you are in?',
    });

    const result = await generateRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toContain('more specific');
    expect(mockValidateTitle).not.toHaveBeenCalled();
  });
});
