import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { CLAUDE_MODEL, buildSystemPrompt } from '../config/prompts.js';

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Parse JSON from Claude's response — handles markdown code fences
function parseClaudeResponse(text) {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return JSON.parse(stripped);
}

export async function getRecommendations({
  message,
  platforms,
  region,
  conversationHistory = [],
  unavailableTitles = [],
}) {
  const systemPrompt = buildSystemPrompt({ platforms, region });

  // Build messages from conversation history
  const messages = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Append unavailable titles note if any
  let userMessage = message;
  if (unavailableTitles.length > 0) {
    userMessage += `\n\n[System note: These titles were previously suggested but are unavailable on the user's platforms in ${region}: ${unavailableTitles.join(', ')}. Do not suggest them again.]`;
  }

  messages.push({ role: 'user', content: userMessage });

  console.log('[Claude] Sending request with', messages.length, 'messages');

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const responseText = response.content[0]?.text || '';
    console.log('[Claude] Raw response:', responseText.substring(0, 500));

    try {
      const parsed = parseClaudeResponse(responseText);
      return {
        recommendations: parsed.recommendations || [],
        followUpMessage: parsed.followUpMessage || '',
      };
    } catch (parseError) {
      console.error('[Claude] JSON parse failed:', parseError.message, '| Raw text:', responseText.substring(0, 300));
      // Use raw text as fallback message so the user still sees Claude's response
      const fallbackMessage = responseText.substring(0, 500) || "I had trouble processing that. Could you rephrase what you're looking for?";
      return {
        recommendations: [],
        followUpMessage: fallbackMessage,
      };
    }
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
