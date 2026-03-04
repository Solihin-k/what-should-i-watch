import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { CLAUDE_MODEL, buildSystemPrompt, buildTagExtractionPrompt, buildTitlePickingPrompt } from '../config/prompts.js';

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Multi-strategy JSON parser — cascading extraction
function parseClaudeResponse(text) {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(text);
  } catch (_) {
    // continue
  }

  // Strategy 2: Strip markdown code fences
  const fenceStripped = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  try {
    return JSON.parse(fenceStripped);
  } catch (_) {
    // continue
  }

  // Strategy 3: Extract from first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (_) {
      // continue
    }
  }

  // All strategies failed
  return null;
}

async function callClaude({ systemPrompt, messages }) {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  return response.content[0]?.text || '';
}

export async function getRecommendations({
  message,
  platforms,
  region,
  conversationHistory = [],
  unavailableTitles = [],
  availableCatalog = '',
}) {
  const systemPrompt = buildSystemPrompt({ platforms, region });

  // Build messages from conversation history
  const messages = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Append catalog and unavailable titles as system notes
  let userMessage = message;
  if (availableCatalog) {
    userMessage += `\n\n[Available titles on user's platforms:\n${availableCatalog}\n]`;
  }
  if (unavailableTitles.length > 0) {
    userMessage += `\n\n[System note: These titles were previously suggested but are unavailable on the user's platforms in ${region}: ${unavailableTitles.join(', ')}. Do not suggest them again.]`;
  }

  messages.push({ role: 'user', content: userMessage });

  console.log('[Claude] Sending request with', messages.length, 'messages');

  try {
    let responseText = await callClaude({ systemPrompt, messages });
    console.log('[Claude] Raw response:', responseText.substring(0, 500));

    let parsed = parseClaudeResponse(responseText);

    // Retry once if parse failed
    if (!parsed) {
      console.log('[Claude] Parse failed, retrying...');
      responseText = await callClaude({ systemPrompt, messages });
      console.log('[Claude] Retry raw response:', responseText.substring(0, 500));
      parsed = parseClaudeResponse(responseText);
    }

    // If still unparseable, return fallback with retryable flag
    if (!parsed) {
      console.error('[Claude] Parse failed after retry | Raw text:', responseText.substring(0, 300));
      const fallbackMessage = responseText.substring(0, 500) || "I had trouble processing that. Could you rephrase what you're looking for?";

      // Diagnostic: check if followUpMessage-like text contains title references
      if (/[""].+[""]/.test(fallbackMessage)) {
        console.warn('[Claude] Warning: 0 recommendations but response may contain title references');
      }

      return {
        recommendations: [],
        followUpMessage: fallbackMessage,
        retryable: true,
      };
    }

    const recommendations = parsed.recommendations || [];
    const followUpMessage = parsed.followUpMessage || '';

    // Count validation: if 1-2 recs instead of 3, re-prompt once
    if (recommendations.length > 0 && recommendations.length < 3) {
      console.log(`[Claude] Got ${recommendations.length} recommendations, re-prompting for exactly 3`);
      const retryMessages = [
        ...messages,
        { role: 'assistant', content: responseText },
        { role: 'user', content: `You only provided ${recommendations.length} recommendations. Please provide exactly 3. Return the full JSON response again with exactly 3 recommendations.` },
      ];

      try {
        const retryText = await callClaude({ systemPrompt, messages: retryMessages });
        console.log('[Claude] Count-retry raw response:', retryText.substring(0, 500));
        const retryParsed = parseClaudeResponse(retryText);
        if (retryParsed && retryParsed.recommendations && retryParsed.recommendations.length === 3) {
          return {
            recommendations: retryParsed.recommendations,
            followUpMessage: retryParsed.followUpMessage || followUpMessage,
          };
        }
      } catch (retryErr) {
        console.error('[Claude] Count-retry failed:', retryErr.message);
      }
      // Fall through — use whatever we got
    }

    return {
      recommendations,
      followUpMessage,
    };
  } catch (error) {
    console.error('[Claude] API error:', { status: error.status, name: error.name, message: error.message });

    // Rate limit
    if (error.status === 429) {
      return {
        recommendations: [],
        followUpMessage: "I'm getting a lot of requests right now. Please try again in a moment.",
      };
    }
    // Auth error
    if (error.status === 401) {
      return {
        recommendations: [],
        followUpMessage: "I'm having trouble connecting to my recommendation engine. Please try again later.",
      };
    }
    return {
      recommendations: [],
      followUpMessage: "I had trouble processing that. Could you rephrase what you're looking for?",
    };
  }
}

const DEFAULT_TAGS = { moods: [], genres: [], bestFor: [], language: null, timeCommitment: null };

export async function extractUserTags({ message, conversationHistory = [] }) {
  const systemPrompt = buildTagExtractionPrompt();

  const messages = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
  messages.push({ role: 'user', content: message });

  console.log('[Claude] Extracting tags from:', message.substring(0, 80));

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages,
    });
    const responseText = response.content[0]?.text || '';
    console.log('[Claude] Tag extraction raw:', responseText.substring(0, 300));

    const parsed = parseClaudeResponse(responseText);
    if (!parsed) {
      console.warn('[Claude] Tag extraction parse failed, using defaults');
      return DEFAULT_TAGS;
    }

    return {
      moods: parsed.moods || [],
      genres: parsed.genres || [],
      bestFor: parsed.bestFor || [],
      language: parsed.language || null,
      timeCommitment: parsed.timeCommitment || null,
    };
  } catch (error) {
    console.error('[Claude] Tag extraction error:', error.message);
    return DEFAULT_TAGS;
  }
}

export async function pickFromCandidates({ message, candidates, platforms, region, conversationHistory = [] }) {
  const systemPrompt = buildTitlePickingPrompt({ platforms, region });

  const messages = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Format candidates as numbered list
  const candidateList = candidates
    .map((c, i) => {
      const genres = (c.genres || []).join(', ');
      const gem = c.hiddenGem ? ' \u2605 hidden gem' : '';
      return `${i + 1}. ${c.title} (${c.year}) [${c.type}] \u2014 ${genres}${gem}`;
    })
    .join('\n');

  const userContent = `${message}\n\n[Community-curated titles available:\n${candidateList}\n]`;
  messages.push({ role: 'user', content: userContent });

  console.log('[Claude] Picking from', candidates.length, 'candidates');

  try {
    let responseText = await callClaude({ systemPrompt, messages });
    console.log('[Claude] Pick raw response:', responseText.substring(0, 500));

    let parsed = parseClaudeResponse(responseText);

    // Retry once if parse failed
    if (!parsed) {
      console.log('[Claude] Pick parse failed, retrying...');
      responseText = await callClaude({ systemPrompt, messages });
      parsed = parseClaudeResponse(responseText);
    }

    if (!parsed) {
      console.error('[Claude] Pick parse failed after retry');
      return { picks: [], followUpMessage: "I had trouble picking titles. Let me try a different approach." };
    }

    const picks = parsed.picks || [];
    const followUpMessage = parsed.followUpMessage || '';

    // Count validation: if 1-5 picks instead of 6, re-prompt once
    if (picks.length > 0 && picks.length < 6) {
      console.log(`[Claude] Got ${picks.length} picks, re-prompting for exactly 6`);
      const retryMessages = [
        ...messages,
        { role: 'assistant', content: responseText },
        { role: 'user', content: `You only provided ${picks.length} picks. Please provide exactly 6. Return the full JSON response again with exactly 6 picks.` },
      ];

      try {
        const retryText = await callClaude({ systemPrompt, messages: retryMessages });
        const retryParsed = parseClaudeResponse(retryText);
        if (retryParsed && retryParsed.picks && retryParsed.picks.length === 6) {
          return {
            picks: retryParsed.picks,
            followUpMessage: retryParsed.followUpMessage || followUpMessage,
          };
        }
      } catch (retryErr) {
        console.error('[Claude] Pick count-retry failed:', retryErr.message);
      }
    }

    return { picks, followUpMessage };
  } catch (error) {
    console.error('[Claude] Pick API error:', { status: error.status, message: error.message });

    if (error.status === 429) {
      return { picks: [], followUpMessage: "I'm getting a lot of requests right now. Please try again in a moment." };
    }
    return { picks: [], followUpMessage: "I had trouble processing that. Could you rephrase what you're looking for?" };
  }
}
