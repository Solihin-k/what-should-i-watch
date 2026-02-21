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
}));

const { getRecommendations } = await import('../services/claudeService.js');

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
