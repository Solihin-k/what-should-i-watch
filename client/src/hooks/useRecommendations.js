import { useState, useEffect, useRef } from 'react';
import { getRecommendations } from '../services/api.js';

// Debounce delay — prevents firing a new request on every rapid platform toggle
const DEBOUNCE_MS = 300;

export function useRecommendations(selectedPlatforms, region) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Clear any pending debounced request
    clearTimeout(timerRef.current);

    if (!selectedPlatforms || selectedPlatforms.length === 0) {
      setRecommendations([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await getRecommendations(selectedPlatforms, region);
        if (!cancelled) setRecommendations(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [selectedPlatforms, region]);

  return { recommendations, loading, error };
}
