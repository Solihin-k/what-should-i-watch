// Mood proximity map — expands user keywords to related DB mood tags
const MOOD_PROXIMITY = {
  tired: ['comfort', 'healing', 'light', 'warm', 'gentle', 'feel-good'],
  sad: ['healing', 'hopeful', 'uplifting', 'warm', 'comfort'],
  stressed: ['comfort', 'escapist', 'light', 'gentle', 'feel-good', 'calming'],
  happy: ['fun', 'uplifting', 'feel-good', 'energetic', 'quirky'],
  bored: ['gripping', 'twisty', 'intense', 'mind-bending', 'provocative'],
  anxious: ['comfort', 'calming', 'gentle', 'healing', 'light'],
  excited: ['intense', 'gripping', 'energetic', 'epic', 'fun'],
  lonely: ['warm', 'heartfelt', 'romantic', 'comfort', 'healing'],
  angry: ['cathartic', 'intense', 'revenge', 'dark', 'gripping'],
  nostalgic: ['classic', 'retro', 'warm', 'heartfelt', 'coming-of-age'],
  romantic: ['romantic', 'warm', 'heartfelt', 'sweet', 'light'],
  curious: ['mind-bending', 'documentary', 'provocative', 'cerebral', 'twisty'],
  chill: ['comfort', 'light', 'gentle', 'calming', 'feel-good'],
  dark: ['dark', 'intense', 'gritty', 'noir', 'psychological'],
  funny: ['fun', 'quirky', 'satirical', 'absurd', 'light'],
  scary: ['horror', 'creepy', 'tense', 'psychological', 'dark'],
  adventurous: ['epic', 'adventure', 'escapist', 'energetic', 'gripping'],
};

// Expand user mood keywords through the proximity map
function expandMoods(userMoods) {
  const expanded = new Set();
  for (const mood of userMoods) {
    const lower = mood.toLowerCase();
    expanded.add(lower);
    const proximate = MOOD_PROXIMITY[lower];
    if (proximate) {
      for (const p of proximate) expanded.add(p);
    }
  }
  return expanded;
}

/**
 * Scores and filters Reddit DB titles against extracted user tags.
 * Returns top candidates sorted by score (descending).
 *
 * @param {Object} params
 * @param {Array} params.redditDb - Full Reddit curated titles array
 * @param {Object} params.extractedTags - { moods[], genres[], bestFor[], language, timeCommitment }
 * @param {string} params.region - ISO 3166-1 region code
 * @param {number} [params.maxCandidates=40] - Maximum candidates to return
 * @returns {Array} Top scored candidates
 */
export function filterCandidates({ redditDb, extractedTags, region, maxCandidates = 40 }) {
  if (!redditDb || redditDb.length === 0) return [];

  const { moods = [], genres = [], bestFor = [], language } = extractedTags;
  const expandedMoods = expandMoods(moods);
  const genreSet = new Set(genres.map((g) => g.toLowerCase()));
  const bestForSet = new Set(bestFor.map((b) => b.toLowerCase()));
  const regionLower = region ? region.toLowerCase() : '';

  const scored = redditDb.map((title) => {
    let score = 0;

    // Mood matching (+3 per match)
    if (title.moods) {
      for (const m of title.moods) {
        if (expandedMoods.has(m.toLowerCase())) score += 3;
      }
    }

    // Genre matching (+2 per match)
    if (title.genres) {
      for (const g of title.genres) {
        if (genreSet.has(g.toLowerCase())) score += 2;
      }
    }

    // bestFor matching (+2 per match)
    if (title.bestFor) {
      for (const b of title.bestFor) {
        if (bestForSet.has(b.toLowerCase())) score += 2;
      }
    }

    // Hidden gem bonus (+3)
    if (title.hiddenGem) score += 3;

    // Region relevance (+1)
    if (title.regionRelevance && regionLower) {
      for (const r of title.regionRelevance) {
        if (r.toLowerCase() === regionLower) {
          score += 1;
          break;
        }
      }
    }

    return { ...title, _score: score };
  });

  // Sort by score descending
  scored.sort((a, b) => b._score - a._score);

  // Language preference: soft-boost matching titles to front within the top candidates
  let candidates = scored.slice(0, maxCandidates);
  if (language) {
    const langSet = Array.isArray(language)
      ? new Set(language.map((l) => l.toLowerCase()))
      : new Set([language.toLowerCase()]);
    const langMatch = [];
    const langOther = [];
    for (const c of candidates) {
      if (c.language && langSet.has(c.language.toLowerCase())) {
        langMatch.push(c);
      } else {
        langOther.push(c);
      }
    }
    candidates = [...langMatch, ...langOther];
  }

  return candidates;
}
