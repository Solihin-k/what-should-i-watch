import { useState } from 'react';

const STORAGE_KEY = 'selected_platforms';

function readFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useSelectedPlatforms() {
  const [selectedPlatforms, setSelectedPlatformsState] = useState(() => readFromStorage());

  function setSelectedPlatforms(value) {
    const next = typeof value === 'function' ? value(selectedPlatforms) : value;
    setSelectedPlatformsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable in some environments — silent fail
    }
  }

  return [selectedPlatforms, setSelectedPlatforms];
}
