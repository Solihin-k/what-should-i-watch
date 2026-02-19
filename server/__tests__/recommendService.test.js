import { jest } from '@jest/globals';

const mockGetRecommendations = jest.fn();
const mockValidateTitle = jest.fn();

jest.unstable_mockModule('../services/claudeService.js', () => ({
  getRecommendations: mockGetRecommendations,
}));

jest.unstable_mockModule('../services/tmdbService.js', () => ({
  validateTitle: mockValidateTitle,
}));

// platforms.js is not mocked — uses real platform data
const { generateRecommendations } = await import('../services/recommendService.js');

beforeEach(() => {
  mockGetRecommendations.mockReset();
  mockValidateTitle.mockReset();
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
    // validateTitle should not be called when there are no recommendations
    expect(mockValidateTitle).not.toHaveBeenCalled();
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
});
