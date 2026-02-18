import { jest } from '@jest/globals';

// Track the mock GET function so we can configure responses per test
const mockGet = jest.fn();

// Mock axios before importing the module under test — ESM requires hoisting via unstable_mockModule
jest.unstable_mockModule('axios', () => ({
  default: {
    create: jest.fn(() => ({ get: mockGet })),
  },
}));

// Dynamic import after mocking — required for ESM module mocking to take effect
const { searchContent, getContentDetails, getWatchProviders, enrichContent } =
  await import('../services/tmdbService.js');

beforeEach(() => {
  mockGet.mockReset();
});

// ─── searchContent ────────────────────────────────────────────────────────────

describe('searchContent', () => {
  it('filters out persons and returns only movie/TV results', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          { id: 1, title: 'Movie A', media_type: 'movie' },
          { id: 2, name: 'Famous Actor', media_type: 'person' },
          { id: 3, name: 'TV Show B', media_type: 'tv' },
        ],
      },
    });

    const results = await searchContent('test');

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.media_type !== 'person')).toBe(true);
    expect(results.map((r) => r.id)).toEqual([1, 3]);
  });

  it('handles an empty results array without error', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [] } });

    const results = await searchContent('no results query');

    expect(results).toEqual([]);
  });
});

// ─── getContentDetails ────────────────────────────────────────────────────────

describe('getContentDetails', () => {
  it('returns the correct normalized fields for a movie', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 123,
        title: 'Test Movie',
        overview: 'A gripping thriller.',
        poster_path: '/poster.jpg',
        vote_average: 8.5,
        genres: [{ id: 28, name: 'Action' }],
        release_date: '2023-01-15',
        runtime: 120,
      },
    });

    const details = await getContentDetails(123, 'movie');

    expect(details).toMatchObject({
      id: 123,
      title: 'Test Movie',
      overview: 'A gripping thriller.',
      poster_path: '/poster.jpg',
      vote_average: 8.5,
      genres: [{ id: 28, name: 'Action' }],
      release_date: '2023-01-15',
      runtime: 120,
    });
  });

  it('returns the correct normalized fields for a TV show', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 456,
        name: 'Severance',
        overview: 'A corporate thriller.',
        poster_path: '/severance.jpg',
        vote_average: 8.7,
        genres: [{ id: 18, name: 'Drama' }],
        first_air_date: '2022-02-18',
        episode_run_time: [45],
      },
    });

    const details = await getContentDetails(456, 'tv');

    expect(details).toMatchObject({
      id: 456,
      title: 'Severance',
      overview: 'A corporate thriller.',
      poster_path: '/severance.jpg',
      vote_average: 8.7,
      genres: [{ id: 18, name: 'Drama' }],
      release_date: '2022-02-18',
      runtime: 45,
    });
  });
});

// ─── getWatchProviders ────────────────────────────────────────────────────────

describe('getWatchProviders', () => {
  it('extracts flatrate subscription providers for the given region', async () => {
    const mockProviders = [
      { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
      { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg' },
    ];

    mockGet.mockResolvedValueOnce({
      data: {
        results: {
          SG: { flatrate: mockProviders, rent: [], buy: [] },
        },
      },
    });

    const providers = await getWatchProviders(123, 'movie', 'SG');

    expect(providers).toEqual(mockProviders);
  });

  it('returns empty array when the requested region has no data', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: { US: { flatrate: [{ provider_id: 8 }] } } },
    });

    // SG not present in results
    const providers = await getWatchProviders(123, 'movie', 'SG');

    expect(providers).toEqual([]);
  });

  it('returns empty array when region exists but has no flatrate providers', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: { SG: { rent: [], buy: [] } } },
    });

    const providers = await getWatchProviders(123, 'movie', 'SG');

    expect(providers).toEqual([]);
  });
});

// ─── enrichContent ────────────────────────────────────────────────────────────

describe('enrichContent', () => {
  it('calls detail and provider functions in parallel and merges results', async () => {
    // First mock response: getContentDetails
    mockGet.mockResolvedValueOnce({
      data: {
        id: 789,
        title: 'Interstellar',
        overview: 'A space odyssey.',
        poster_path: '/interstellar.jpg',
        vote_average: 8.6,
        genres: [{ id: 878, name: 'Science Fiction' }],
        release_date: '2014-11-07',
        runtime: 169,
      },
    });

    // Second mock response: getWatchProviders
    mockGet.mockResolvedValueOnce({
      data: {
        results: {
          SG: {
            flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
          },
        },
      },
    });

    const result = await enrichContent(789, 'movie', 'SG');

    expect(result).toMatchObject({
      id: 789,
      title: 'Interstellar',
      providers: [{ provider_id: 8, provider_name: 'Netflix' }],
    });

    // Both API calls should have been made
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
