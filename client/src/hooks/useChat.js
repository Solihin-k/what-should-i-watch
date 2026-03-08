import { useState, useCallback, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api.js';

const GREETING = "Hey! Tell me what you're in the mood for — how are you feeling, who's watching, and how much time do you have?";

const SUGGESTION_CHIPS = [
  { icon: '😴', label: 'Tired after work', message: 'Tired after work' },
  { icon: '🎉', label: 'Date night', message: 'Date night' },
  { icon: '🍿', label: 'Quick laugh', message: 'Quick laugh' },
  { icon: '🎭', label: 'Something deep', message: 'Something deep' },
];

const FOLLOW_UP_CHIPS = [
  { icon: '🔄', label: 'More like these', message: 'Show me more like these' },
  { icon: '💎', label: 'Less mainstream', message: 'Something less mainstream' },
  { icon: '🎨', label: 'Different mood', message: 'Different mood' },
  { icon: '🌐', label: 'Different language', message: 'Different language' },
];

function createGreeting() {
  return { role: 'assistant', content: GREETING, recommendations: [], chips: SUGGESTION_CHIPS };
}

export function useChat(selectedPlatforms, region) {
  const [messages, setMessages] = useState([createGreeting()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);
  const lastMessageRef = useRef('');

  // Reset chat when platforms change
  const prevPlatformsRef = useRef(selectedPlatforms);
  useEffect(() => {
    const prev = prevPlatformsRef.current;
    const changed =
      prev.length !== selectedPlatforms.length ||
      prev.some((p, i) => p !== selectedPlatforms[i]);
    if (changed) {
      prevPlatformsRef.current = selectedPlatforms;
      setMessages([createGreeting()]);
      setError(null);
    }
  }, [selectedPlatforms]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      lastMessageRef.current = text;
      const userMessage = { role: 'user', content: text, recommendations: [] };
      // Clear suggestion chips from greeting when user sends first message
      setMessages((prev) => [
        ...prev.map((m) => (m.chips ? { ...m, chips: undefined } : m)),
        userMessage,
      ]);
      setLoading(true);
      setError(null);
      cancelledRef.current = false;

      try {
        // Build conversation history — skip everything before the first user message
        // so the history always starts with role: 'user' (required by Claude API)
        const allMessages = [...messages, userMessage];
        const firstUserIdx = allMessages.findIndex((m) => m.role === 'user');
        const recentMessages = allMessages
          .slice(firstUserIdx)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await sendChatMessage({
          message: text,
          platforms: selectedPlatforms,
          region,
          conversationHistory: recentMessages.slice(0, -1), // exclude current message
        });

        if (cancelledRef.current) return;

        const assistantMessage = {
          role: 'assistant',
          content: response.followUpMessage,
          recommendations: response.recommendations || [],
          ...(response.retryable && { retryable: true }),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err.message);
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
      }
    },
    [messages, selectedPlatforms, region, loading]
  );

  const retryLastMessage = useCallback(() => {
    if (lastMessageRef.current) {
      // Remove the last assistant message (the failed one) before retrying
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.retryable) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      // Use setTimeout to let state update before sending
      setTimeout(() => sendMessage(lastMessageRef.current), 0);
    }
  }, [sendMessage]);

  const injectInitialRecommendations = useCallback((summaryMessage, response) => {
    const userMsg = { role: 'user', content: summaryMessage, recommendations: [] };
    const assistantMsg = {
      role: 'assistant',
      content: response.followUpMessage || 'Here are my picks for you!',
      recommendations: response.recommendations || [],
      chips: FOLLOW_UP_CHIPS,
    };
    setMessages([userMsg, assistantMsg]);
    setError(null);
  }, []);

  const resetChat = useCallback(() => {
    cancelledRef.current = true;
    setMessages([createGreeting()]);
    setLoading(false);
    setError(null);
  }, []);

  return { messages, sendMessage, loading, error, resetChat, retryLastMessage, injectInitialRecommendations };
}
