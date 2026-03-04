import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'reddit-curated-titles.json');

let redditDb = [];

export function loadRedditDb() {
  try {
    const raw = readFileSync(DB_PATH, 'utf-8');
    redditDb = JSON.parse(raw);
    if (!Array.isArray(redditDb)) {
      console.warn('[RedditDb] File did not contain an array, using empty list');
      redditDb = [];
    }
    console.log(`[RedditDb] Loaded ${redditDb.length} titles`);
  } catch (err) {
    console.warn('[RedditDb] Failed to load:', err.message, '— using empty list');
    redditDb = [];
  }
}

export function getRedditDb() {
  return redditDb;
}
