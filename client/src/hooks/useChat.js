import { useState, useCallback, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api.js';

const GREETING = "Hey! Tell me what you're in the mood for — how are you feeling, who's watching, and how much time do you have?";

const SUGGESTION_CHIPS = [
  { label: '😴 Tired after work', message: 'Tired after work' },
  { label: '🎉 Date night', message: 'Date night' },
  { label: '🍿 Quick laugh', message: 'Quick laugh' },
  { label: '🎭 Something deep', message: 'Something deep' },
];

function createGreeting() {
  return { role: 'assistant', content: GREETING, recommendations: [], chips: SUGGESTION_CHIPS };
}

export function useChat(selectedPlatforms, region) {
  const [messages, setMessages] = useState([createGreeting()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

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

  const resetChat = useCallback(() => {
    cancelledRef.current = true;
    setMessages([createGreeting()]);
    setLoading(false);
    setError(null);
  }, []);

  return { messages, sendMessage, loading, error, resetChat };
}
