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

describe('getRecommendations', () => {
  const baseParams = {
    message: 'something funny',
    platforms: [{ id: 'netflix', name: 'Netflix', tmdbProviderId: 8 }],
    region: 'SG',
    conversationHistory: [],
  };

  it('parses valid JSON response correctly', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        text: JSON.stringify({
          recommendations: [
            { title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', reasoning: 'Witty comedy' },
          ],
          followUpMessage: 'Here you go!',
        }),
      }],
    });

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe('The Grand Budapest Hotel');
    expect(result.followUpMessage).toBe('Here you go!');
  });

  it('handles JSON wrapped in markdown code fences', async () => {
    const json = JSON.stringify({
      recommendations: [{ title: 'Parasite', year: 2019, type: 'movie', reasoning: 'Great thriller' }],
      followUpMessage: 'A classic!',
    });

    mockCreate.mockResolvedValueOnce({
      content: [{ text: '```json\n' + json + '\n```' }],
    });

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe('Parasite');
  });

  it('returns fallback on invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: 'This is not JSON at all' }],
    });

    const result = await getRecommendations(baseParams);

    expect(result.recommendations).toEqual([]);
    expect(result.followUpMessage).toBeTruthy();
  });

  it('passes conversation history to Claude', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        text: JSON.stringify({ recommendations: [], followUpMessage: 'What genre?' }),
      }],
    });

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
    mockCreate.mockResolvedValueOnce({
      content: [{
        text: JSON.stringify({ recommendations: [], followUpMessage: 'Noted!' }),
      }],
    });

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
