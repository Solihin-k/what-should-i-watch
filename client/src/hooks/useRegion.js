import { useState, useEffect } from 'react';
import { getRegion } from '../services/api.js';

export function useRegion() {
  const [region, setRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function detectRegion() {
      setLoading(true);
      setError(null);
      try {
        const data = await getRegion();
        if (!cancelled) setRegion(data);
      } catch (err) {
        // Fall back to Singapore on error — primary market
        if (!cancelled) {
          setRegion({ countryCode: 'SG', countryName: 'Singapore' });
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detectRegion();
    return () => { cancelled = true; };
  }, []);

  return { region, setRegion, loading, error };
}
