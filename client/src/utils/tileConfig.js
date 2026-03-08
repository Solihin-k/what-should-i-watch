export const STEPS = [
  {
    id: 'vibe',
    question: 'What vibe are you feeling?',
    tiles: [
      { id: 'comfort', label: 'Comfort / Feel-good', icon: '🧸', tags: { moods: ['comfort', 'feel-good', 'warm', 'healing'] } },
      { id: 'quick-laugh', label: 'Quick Laugh', icon: '😂', tags: { moods: ['fun', 'quirky', 'light'], genres: ['comedy'] } },
      { id: 'intense', label: 'Intense', icon: '🔥', tags: { moods: ['intense', 'gripping', 'tense'], genres: ['thriller', 'action'] } },
      { id: 'deep', label: 'Something Deep', icon: '🎭', tags: { moods: ['thought-provoking', 'cerebral', 'provocative'], genres: ['drama'] } },
      { id: 'romantic', label: 'Romantic', icon: '💕', tags: { moods: ['romantic', 'warm', 'heartfelt'], genres: ['romance'] } },
      { id: 'mind-bending', label: 'Mind-bending', icon: '🌀', tags: { moods: ['mind-bending', 'twisty', 'cerebral'], genres: ['sci-fi', 'thriller'] } },
    ],
  },
  {
    id: 'audience',
    question: "Who's watching?",
    tiles: [
      { id: 'solo', label: 'Just Me', icon: '🧘', tags: { bestFor: ['solo'] } },
      { id: 'partner', label: 'With Partner', icon: '💑', tags: { bestFor: ['date night', 'couples'] } },
      { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', tags: { bestFor: ['family'] } },
      { id: 'friends', label: 'Friends', icon: '🎉', tags: { bestFor: ['friends'] } },
    ],
  },
  {
    id: 'time',
    question: 'How much time do you have?',
    tiles: [
      { id: 'quick', label: 'Quick Watch', icon: '⚡', tags: { timeCommitment: 'short', contentType: 'series' } },
      { id: 'movie-night', label: 'Movie Night', icon: '🎬', tags: { timeCommitment: 'short', contentType: 'movie' } },
      { id: 'mini-binge', label: 'Mini Binge', icon: '📺', tags: { timeCommitment: 'long' } },
      { id: 'all-day', label: 'All Day Binge', icon: '🛋️', tags: { timeCommitment: 'long' } },
    ],
  },
  {
    id: 'content',
    question: 'Any content preference?',
    multiSelect: true,
    tiles: [
      { id: 'korean', label: 'K-Drama', icon: '🇰🇷', tags: { language: 'Korean' } },
      { id: 'anime', label: 'Anime', icon: '🇯🇵', tags: { language: 'Japanese', genres: ['anime'] } },
      { id: 'asian', label: 'Asian', icon: '🌏', tags: { language: ['Mandarin', 'Cantonese', 'Thai', 'Vietnamese', 'Indonesian', 'Filipino'] } },
      { id: 'english', label: 'English', icon: '🌍', tags: { language: 'English' } },
      { id: 'surprise', label: 'Surprise Me', icon: '🎲', tags: { language: null, boostHiddenGem: true } },
    ],
  },
];

// Resolve tile IDs from a selection (handles both single and multi-select)
function resolveTiles(sel) {
  const step = STEPS[sel.stepIndex];
  if (!step) return [];
  const ids = sel.tileIds ? sel.tileIds : [sel.tileId];
  return ids.map((id) => step.tiles.find((t) => t.id === id)).filter(Boolean);
}

export function buildTagsFromSelections(selections) {
  const merged = { moods: [], genres: [], bestFor: [], language: null, timeCommitment: null, contentType: null, boostHiddenGem: false };

  for (const sel of selections) {
    const tiles = resolveTiles(sel);
    for (const tile of tiles) {
      const { tags } = tile;
      if (tags.moods) merged.moods.push(...tags.moods);
      if (tags.genres) merged.genres.push(...tags.genres);
      if (tags.bestFor) merged.bestFor.push(...tags.bestFor);
      if (tags.language !== undefined) merged.language = tags.language;
      if (tags.timeCommitment) merged.timeCommitment = tags.timeCommitment;
      if (tags.contentType) merged.contentType = tags.contentType;
      if (tags.boostHiddenGem) merged.boostHiddenGem = true;
    }
  }

  return merged;
}

export function buildSummaryMessage(selections) {
  const parts = [];
  for (const sel of selections) {
    const tiles = resolveTiles(sel);
    for (const tile of tiles) {
      parts.push(`${tile.icon} ${tile.label}`);
    }
  }
  return parts.join(' · ');
}
