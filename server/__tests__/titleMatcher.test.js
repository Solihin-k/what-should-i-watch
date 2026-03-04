import { filterCandidates } from '../services/titleMatcher.js';

function makeTitle(overrides = {}) {
  return {
    title: 'Test Movie',
    year: 2023,
    type: 'movie',
    language: 'english',
    genres: [],
    moods: [],
    bestFor: [],
    regionRelevance: [],
    hiddenGem: false,
    ...overrides,
  };
}

describe('filterCandidates', () => {
  it('returns empty array for empty DB', () => {
    const result = filterCandidates({
      redditDb: [],
      extractedTags: { moods: ['happy'], genres: ['comedy'] },
      region: 'SG',
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for null DB', () => {
    const result = filterCandidates({
      redditDb: null,
      extractedTags: { moods: ['happy'] },
      region: 'SG',
    });
    expect(result).toEqual([]);
  });

  it('scores mood matches at +3 each', () => {
    const db = [
      makeTitle({ title: 'A', moods: ['comfort', 'healing'] }),
      makeTitle({ title: 'B', moods: ['intense'] }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['comfort'], genres: [], bestFor: [] },
      region: 'SG',
    });

    expect(result[0].title).toBe('A');
    expect(result[0]._score).toBe(3);
    expect(result[1].title).toBe('B');
    expect(result[1]._score).toBe(0);
  });

  it('expands mood keywords through proximity map', () => {
    const db = [
      makeTitle({ title: 'Comfort Show', moods: ['comfort', 'healing'] }),
      makeTitle({ title: 'Action Movie', moods: ['intense'] }),
    ];

    // "tired" expands to comfort, healing, light, warm, gentle, feel-good
    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['tired'], genres: [], bestFor: [] },
      region: 'SG',
    });

    expect(result[0].title).toBe('Comfort Show');
    // comfort (+3) + healing (+3) = 6
    expect(result[0]._score).toBe(6);
  });

  it('scores genre matches at +2 each', () => {
    const db = [
      makeTitle({ title: 'Comedy', genres: ['comedy', 'romance'] }),
      makeTitle({ title: 'Horror', genres: ['horror'] }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: [], genres: ['comedy', 'romance'], bestFor: [] },
      region: 'SG',
    });

    expect(result[0].title).toBe('Comedy');
    expect(result[0]._score).toBe(4);
  });

  it('scores bestFor matches at +2 each', () => {
    const db = [
      makeTitle({ title: 'Date Movie', bestFor: ['date-night'] }),
      makeTitle({ title: 'Solo Movie', bestFor: ['solo'] }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: [], genres: [], bestFor: ['date-night'] },
      region: 'SG',
    });

    expect(result[0].title).toBe('Date Movie');
    expect(result[0]._score).toBe(2);
  });

  it('adds +3 hidden gem bonus', () => {
    const db = [
      makeTitle({ title: 'Gem', hiddenGem: true }),
      makeTitle({ title: 'Popular', hiddenGem: false }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: [], genres: [], bestFor: [] },
      region: 'SG',
    });

    expect(result[0].title).toBe('Gem');
    expect(result[0]._score).toBe(3);
  });

  it('adds +1 for region match', () => {
    const db = [
      makeTitle({ title: 'SG Movie', regionRelevance: ['SG', 'MY'] }),
      makeTitle({ title: 'US Movie', regionRelevance: ['US'] }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: [], genres: [], bestFor: [] },
      region: 'SG',
    });

    expect(result[0].title).toBe('SG Movie');
    expect(result[0]._score).toBe(1);
  });

  it('soft-boosts language matches to front', () => {
    const db = [
      makeTitle({ title: 'English A', language: 'english', moods: ['comfort'] }),
      makeTitle({ title: 'Korean B', language: 'korean', moods: ['comfort', 'healing'] }),
      makeTitle({ title: 'Korean C', language: 'korean', moods: ['comfort'] }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['comfort'], genres: [], bestFor: [], language: 'korean' },
      region: 'SG',
    });

    // Korean B has highest score (6) and is Korean — should be first
    expect(result[0].title).toBe('Korean B');
    // Korean C (score 3) should come before English A (score 3) due to language boost
    expect(result[1].title).toBe('Korean C');
    expect(result[2].title).toBe('English A');
  });

  it('respects maxCandidates cap', () => {
    const db = Array.from({ length: 100 }, (_, i) =>
      makeTitle({ title: `Movie ${i}`, moods: ['comfort'] }),
    );

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['comfort'], genres: [], bestFor: [] },
      region: 'SG',
      maxCandidates: 10,
    });

    expect(result).toHaveLength(10);
  });

  it('defaults to maxCandidates of 40', () => {
    const db = Array.from({ length: 100 }, (_, i) =>
      makeTitle({ title: `Movie ${i}`, moods: ['comfort'] }),
    );

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['comfort'], genres: [], bestFor: [] },
      region: 'SG',
    });

    expect(result).toHaveLength(40);
  });

  it('handles empty extracted tags gracefully', () => {
    const db = [
      makeTitle({ title: 'Gem', hiddenGem: true }),
      makeTitle({ title: 'Normal' }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: {},
      region: 'SG',
    });

    // Should still work — hidden gem gets +3, normal gets 0
    expect(result[0].title).toBe('Gem');
    expect(result).toHaveLength(2);
  });

  it('combines all scoring factors', () => {
    const db = [
      makeTitle({
        title: 'Perfect Match',
        moods: ['comfort'],
        genres: ['comedy'],
        bestFor: ['solo'],
        hiddenGem: true,
        regionRelevance: ['SG'],
      }),
      makeTitle({ title: 'No Match' }),
    ];

    const result = filterCandidates({
      redditDb: db,
      extractedTags: { moods: ['comfort'], genres: ['comedy'], bestFor: ['solo'] },
      region: 'SG',
    });

    // comfort(+3) + comedy(+2) + solo(+2) + hiddenGem(+3) + region(+1) = 11
    expect(result[0].title).toBe('Perfect Match');
    expect(result[0]._score).toBe(11);
  });
});
