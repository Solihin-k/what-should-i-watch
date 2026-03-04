import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: function Anthropic() {
    this.messages = { create: mockCreate };
  },
}));

jest.unstable_mockModule('../config/prompts.js', () => ({
  CLAUDE_MODEL: 'test-model',
  buildSystemPrompt: jest.fn(() => 'test system prompt'),
  buildTagExtractionPrompt: jest.fn(() => 'test tag extraction prompt'),
  buildTitlePickingPrompt: jest.fn(() => 'test title picking prompt'),
}));

const { getRecommendations, extractUserTags, pickFromCandidates } = await import('../services/claudeService.js');

beforeEach(() => {
  mockCreate.mockReset();
});

function makeResponse(text) {
  return { content: [{ text }] };
}

function makeJsonResponse(obj) {
  return makeResponse(JSON.stringify(obj));
}

const validResponse = {
  recommendations: [
    { title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', reasoning: 'Witty comedy' },
    { title: 'Parasite', year: 2019, type: 'movie', reasoning: 'Great thriller' },
    { title: 'Spirited Away', year: 2001, type: 'movie', reasoning: 'Beautiful animation' },
  ],
  followUpMessage: 'Here you go!',
};

describe('getRecommendations', () => {
  const baseParams = {
    message: 'something funny',
    platforms: [{ id: 'netflix', name: 'Netflix', tmdbProviderId: 8 }],
    region: 'SG',
    conversationHistory: [],
  };

  it('parses valid JSON response correctly', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse(validResponse));

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
    expect(result.followUpMessage).toBe('Here you go!');
    expect(result.retryable).toBeUndefined();
  });

  it('handles JSON wrapped in markdown code fences', async () => {
    const json = JSON.stringify(validResponse);
    mockCreate.mockResolvedValueOnce(makeResponse('```json\n' + json + '\n```'));

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
  });

  it('extracts JSON embedded in surrounding text (first { to last })', async () => {
    const json = JSON.stringify(validResponse);
    mockCreate.mockResolvedValueOnce(makeResponse('Here are my picks:\n' + json + '\nHope you enjoy!'));

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
  });

  it('retries once on parse failure, succeeds on retry', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('This is not JSON at all'))
      .mockResolvedValueOnce(makeJsonResponse(validResponse));

    const result = await getRecommendations(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.recommendations).toHaveLength(3);
    expect(result.retryable).toBeUndefined();
  });

  it('returns fallback with retryable flag when both attempts fail to parse', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('Not JSON'))
      .mockResolvedValueOnce(makeResponse('Still not JSON'));

    const result = await getRecommendations(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toBeTruthy();
    expect(result.retryable).toBe(true);
  });

  it('re-prompts when fewer than 3 recommendations returned', async () => {
    const twoRecs = {
      recommendations: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Movie B', year: 2023, type: 'movie', reasoning: 'Also good' },
      ],
      followUpMessage: 'Here are some!',
    };

    mockCreate
      .mockResolvedValueOnce(makeJsonResponse(twoRecs))
      .mockResolvedValueOnce(makeJsonResponse(validResponse));

    const result = await getRecommendations(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.recommendations).toHaveLength(3);
  });

  it('uses partial results if count re-prompt still has <3', async () => {
    const twoRecs = {
      recommendations: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Movie B', year: 2023, type: 'movie', reasoning: 'Also good' },
      ],
      followUpMessage: 'Here are some!',
    };

    mockCreate
      .mockResolvedValueOnce(makeJsonResponse(twoRecs))
      .mockResolvedValueOnce(makeJsonResponse(twoRecs)); // still 2

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(2);
  });

  it('does not re-prompt for 0 recommendations (clarifying question)', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse({
      recommendations: [],
      followUpMessage: 'What genre?',
    }));

    const result = await getRecommendations(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toBe('What genre?');
  });

  it('passes conversation history to Claude', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse({
      recommendations: [],
      followUpMessage: 'What genre?',
    }));

    await getRecommendations({
      ...baseParams,
      conversationHistory: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    // history (2) + current message (1) = 3
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0]).toEqual({ role: 'user', content: 'hi' });
    expect(callArgs.messages[1]).toEqual({ role: 'assistant', content: 'hello' });
  });

  it('appends unavailable titles note to user message', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse({
      recommendations: [],
      followUpMessage: 'Noted!',
    }));

    await getRecommendations({
      ...baseParams,
      unavailableTitles: ['Movie A', 'Movie B'],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg.content).toContain('Movie A');
    expect(lastMsg.content).toContain('Movie B');
  });

  it('handles rate limit (429) gracefully', async () => {
    const error = new Error('Rate limited');
    error.status = 429;
    mockCreate.mockRejectedValueOnce(error);

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toContain('try again');
  });

  it('handles auth error (401) gracefully', async () => {
    const error = new Error('Unauthorized');
    error.status = 401;
    mockCreate.mockRejectedValueOnce(error);

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toContain('trouble');
  });
});

describe('extractUserTags', () => {
  const baseParams = {
    message: 'I feel tired and want something comforting',
    conversationHistory: [],
  };

  it('parses valid tag extraction response', async () => {
    const tagResponse = {
      moods: ['tired', 'comfort'],
      genres: ['drama'],
      bestFor: ['solo'],
      language: null,
      timeCommitment: null,
    };
    mockCreate.mockResolvedValueOnce(makeJsonResponse(tagResponse));

    const result = await extractUserTags(baseParams);

    expect(result.moods).toEqual(['tired', 'comfort']);
    expect(result.genres).toEqual(['drama']);
    expect(result.bestFor).toEqual(['solo']);
    expect(result.language).toBeNull();
  });

  it('returns safe defaults on parse failure', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('not json at all'));

    const result = await extractUserTags(baseParams);

    expect(result.moods).toEqual([]);
    expect(result.genres).toEqual([]);
    expect(result.bestFor).toEqual([]);
    expect(result.language).toBeNull();
    expect(result.timeCommitment).toBeNull();
  });

  it('returns safe defaults on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down'));

    const result = await extractUserTags(baseParams);

    expect(result.moods).toEqual([]);
    expect(result.genres).toEqual([]);
  });

  it('includes conversation history in messages', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse({
      moods: ['dark'],
      genres: [],
      bestFor: [],
      language: null,
      timeCommitment: null,
    }));

    await extractUserTags({
      message: 'something darker',
      conversationHistory: [
        { role: 'user', content: 'recommend something' },
        { role: 'assistant', content: 'what mood?' },
      ],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0].content).toBe('recommend something');
    expect(callArgs.messages[2].content).toBe('something darker');
  });

  it('uses max_tokens of 256', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse({
      moods: [],
      genres: [],
      bestFor: [],
      language: null,
      timeCommitment: null,
    }));

    await extractUserTags(baseParams);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(256);
  });
});

describe('pickFromCandidates', () => {
  const basePlatforms = [{ id: 'netflix', name: 'Netflix', tmdbProviderId: 8 }];
  const baseCandidates = [
    { title: 'Movie A', year: 2023, type: 'movie', genres: ['comedy'], hiddenGem: false },
    { title: 'Movie B', year: 2022, type: 'movie', genres: ['drama'], hiddenGem: true },
    { title: 'Show C', year: 2021, type: 'series', genres: ['thriller'], hiddenGem: false },
  ];
  const baseParams = {
    message: 'something funny',
    candidates: baseCandidates,
    platforms: basePlatforms,
    region: 'SG',
    conversationHistory: [],
  };

  const validPickResponse = {
    picks: [
      { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Funny' },
      { title: 'Movie B', year: 2022, type: 'movie', reasoning: 'Great drama' },
      { title: 'Show C', year: 2021, type: 'series', reasoning: 'Thrilling' },
      { title: 'Movie D', year: 2020, type: 'movie', reasoning: 'Classic' },
      { title: 'Show E', year: 2019, type: 'series', reasoning: 'Engaging' },
      { title: 'Movie F', year: 2018, type: 'movie', reasoning: 'Beautiful' },
    ],
    followUpMessage: 'Great picks!',
  };

  it('parses 6-pick response correctly', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse(validPickResponse));

    const result = await pickFromCandidates(baseParams);

    expect(result.picks).toHaveLength(6);
    expect(result.picks[0].title).toBe('Movie A');
    expect(result.followUpMessage).toBe('Great picks!');
  });

  it('re-prompts when fewer than 6 picks', async () => {
    const threePicks = {
      picks: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Movie B', year: 2022, type: 'movie', reasoning: 'Also good' },
        { title: 'Show C', year: 2021, type: 'series', reasoning: 'Nice' },
      ],
      followUpMessage: 'Here!',
    };

    mockCreate
      .mockResolvedValueOnce(makeJsonResponse(threePicks))
      .mockResolvedValueOnce(makeJsonResponse(validPickResponse));

    const result = await pickFromCandidates(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.picks).toHaveLength(6);
  });

  it('returns partial results if count retry still insufficient', async () => {
    const threePicks = {
      picks: [
        { title: 'Movie A', year: 2023, type: 'movie', reasoning: 'Good' },
        { title: 'Movie B', year: 2022, type: 'movie', reasoning: 'Also good' },
        { title: 'Show C', year: 2021, type: 'series', reasoning: 'Nice' },
      ],
      followUpMessage: 'Here!',
    };

    mockCreate
      .mockResolvedValueOnce(makeJsonResponse(threePicks))
      .mockResolvedValueOnce(makeJsonResponse(threePicks));

    const result = await pickFromCandidates(baseParams);

    expect(result.picks).toHaveLength(3);
  });

  it('handles parse failure with retry', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('not json'))
      .mockResolvedValueOnce(makeJsonResponse(validPickResponse));

    const result = await pickFromCandidates(baseParams);

    expect(result.picks).toHaveLength(6);
  });

  it('returns empty picks on double parse failure', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('nope'))
      .mockResolvedValueOnce(makeResponse('still nope'));

    const result = await pickFromCandidates(baseParams);

    expect(result.picks).toEqual([]);
    expect(result.followUpMessage).toBeTruthy();
  });

  it('handles rate limit (429) gracefully', async () => {
    const error = new Error('Rate limited');
    error.status = 429;
    mockCreate.mockRejectedValueOnce(error);

    const result = await pickFromCandidates(baseParams);

    expect(result.picks).toEqual([]);
    expect(result.followUpMessage).toContain('try again');
  });

  it('formats candidates as numbered list with hidden gem marker', async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse(validPickResponse));

    await pickFromCandidates(baseParams);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages[callArgs.messages.length - 1].content;
    expect(userMsg).toContain('1. Movie A (2023) [movie]');
    expect(userMsg).toContain('2. Movie B (2022) [movie]');
    expect(userMsg).toContain('hidden gem');
  });
});
