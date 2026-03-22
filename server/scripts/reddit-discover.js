import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'data', 'reddit-raw-discoveries.json');

const SUBREDDITS = [
  'MovieSuggestions',
  'kdrama',
  'anime',
  'television',
  'CDrama',
  'jdrama',
  'asiandrama',
  'horror',
  'movies',
];

const USER_AGENT = 'WhatShouldIWatch/1.0 (content discovery script)';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=month&limit=25`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for r/${subreddit}`);
  }

  const data = await res.json();
  const posts = data.data?.children || [];

  return posts.map((child) => ({
    title: child.data.title,
    upvotes: child.data.ups,
    url: `https://www.reddit.com${child.data.permalink}`,
    subreddit: `r/${subreddit}`,
    postId: child.data.id,
  }));
}

async function fetchTopComments(permalink) {
  const url = `https://www.reddit.com${permalink}.json?limit=3&sort=top`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const commentListing = data[1]?.data?.children || [];

  return commentListing
    .filter((c) => c.kind === 't1' && c.data.body)
    .slice(0, 3)
    .map((c) => ({
      text: c.data.body.slice(0, 500),
      upvotes: c.data.ups,
      author: c.data.author,
    }));
}

async function main() {
  console.log('Reddit Discovery Script');
  console.log('=======================\n');

  const allResults = [];

  for (const subreddit of SUBREDDITS) {
    console.log(`Fetching r/${subreddit}...`);

    try {
      const posts = await fetchSubreddit(subreddit);
      console.log(`  Found ${posts.length} posts`);

      // Fetch top comments for each post (with rate limiting)
      for (const post of posts) {
        const permalink = new URL(post.url).pathname;
        try {
          post.topComments = await fetchTopComments(permalink);
        } catch {
          post.topComments = [];
        }
        await sleep(2000);
      }

      allResults.push({
        subreddit: `r/${subreddit}`,
        fetchedAt: new Date().toISOString(),
        posts,
      });
    } catch (err) {
      console.error(`  Error fetching r/${subreddit}:`, err.message);
      allResults.push({
        subreddit: `r/${subreddit}`,
        fetchedAt: new Date().toISOString(),
        error: err.message,
        posts: [],
      });
    }

    // Rate limit between subreddits
    await sleep(2000);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(allResults, null, 2));
  console.log(`\nDone! Saved to ${OUTPUT_PATH}`);

  const totalPosts = allResults.reduce((sum, r) => sum + r.posts.length, 0);
  console.log(`Total posts collected: ${totalPosts}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
