import { useState, useEffect } from 'react';
import { getPlatforms } from '../services/api.js';

export function usePlatforms(region) {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlatforms() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPlatforms(region);
        if (!cancelled) setPlatforms(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlatforms();
    return () => { cancelled = true; };
  }, [region]);

  return { platforms, loading, error };
}
