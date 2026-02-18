# What Should I Watch? — Product Specification

## 1. Problem Statement

Choosing what to watch has become paradoxically harder as streaming options have multiplied. The average household in Singapore subscribes to 2-4 streaming platforms, each with its own recommendation engine optimized to keep users within that single platform. Nobody answers the real user question:

> "It's Friday night, I have 90 minutes, I'm with my partner, we're in a cozy mood, and we have Netflix and Disney+ — what should we watch?"

Existing solutions fail because:
- **Platform recommendation engines** only suggest content from their own catalog
- **Review aggregators** (IMDb, Rotten Tomatoes) don't know what's available on your platforms or in your region
- **JustWatch** helps with "where to watch" but not "what to watch based on my mood and context"
- **No tool accounts for the regional catalog problem** — Netflix Singapore has a completely different library than Netflix US

## 2. Competitive Analysis

### 2.1 Market Landscape

The "what should I watch" problem is well-recognized — users spend an average of 10.5 minutes per session deciding what to watch (up 40% since 2019), and 20% abandon their search entirely. One-third of viewers have canceled a streaming service because search was too hard, and 66% because they felt there was "nothing good to watch." Despite this, no existing solution adequately serves Singapore and SEA audiences.

### 2.2 Existing Solutions

#### Traditional Streaming Aggregators (Non-AI)

| Product | Strengths | Weaknesses | SEA Coverage |
|---------|-----------|------------|--------------|
| **JustWatch** | Largest global coverage (100+ countries), tells you *where* to watch a known title, supports SG | No conversational AI, weak at "what should I watch?", filter-based discovery only | ✅ Partial (major platforms only) |
| **Reelgood** | Best US-based aggregator, 150+ platforms, social features, good genre browsing | US/UK only — not available in Singapore or SEA | ❌ None |
| **Watchworthy** | Swipe-based recommendations, crowdsourced ratings | US-focused, availability data often outdated, no SEA presence | ❌ None |

#### AI-Powered Recommendations

| Product | Strengths | Weaknesses | SEA Coverage |
|---------|-----------|------------|--------------|
| **cineSearch / Ava (Cineverse)** | Conversational AI chatbot, mood/theme-based recommendations, 2M+ titles, cross-platform search across 60+ services | US-centric, B2B licensing focus (not consumer-first), no SEA regional platforms, no multi-person recommendations | ❌ None |
| **Reelgood Cue** | Basic AI assistant within Reelgood app | Limited capabilities, US/UK only | ❌ None |

#### Portfolio/Student Projects (GitHub)
Dozens of "movie recommendation chatbot" repos exist, but they are tech demos — no real users, no platform availability awareness, no product thinking documented.

### 2.3 Key User Pain Points (From Industry Data & User Reviews)

1. **Decision fatigue is quantified and severe** — 10+ minutes average search time, 20% abandonment rate, directly causes subscription cancellations
2. **Availability data is frequently wrong** — Watchworthy users report getting excited about a show only to find it's no longer on the listed platform
3. **Existing tools fail groups** — No solution helps 2+ people with different tastes find something to watch together. As one review noted: "If you have to compromise with your spouse or roommate, [existing tools don't] help at all"
4. **Recommendations lack emotional nuance** — Traditional search trains users to query by title or genre. Users actually want mood-based, context-aware suggestions ("I'm exhausted and want something light")
5. **International users are underserved** — Reelgood is US/UK only, cineSearch is US-focused, and no tool understands regional SEA platforms or local content preferences (K-drama, C-drama, anime)

### 2.4 Our Competitive Positioning

| Capability | JustWatch | Reelgood | cineSearch (Ava) | **What Should I Watch?** |
|---|---|---|---|---|
| Conversational AI | ❌ | ❌ | ✅ | ✅ |
| Singapore/SEA focus | Partial | ❌ | ❌ | ✅ |
| Regional platforms (Viu, meWATCH, Viki) | Partial | ❌ | ❌ | ✅ (Tier 2) |
| Watch group (multi-person) | ❌ | ❌ | ❌ | ✅ |
| Mood/context-based | Filters only | Filters only | ✅ | ✅ |
| Region-aware availability | ✅ | ❌ (US/UK only) | Partial | ✅ |
| Free consumer product | ✅ | ✅ | Preview | ✅ |

**Our wedge:** The AI-powered "what should I watch" tool built specifically for Singapore and SEA audiences, with regional platform awareness and multi-person recommendation — a combination no competitor offers. We compete on the intersection of conversational AI + regional relevance + group viewing, not on catalog breadth.

## 3. Target Users

### Primary Persona: "The Overwhelmed Subscriber" (Singapore/SEA)
- Age 25-40, subscribes to 2-4 streaming platforms
- Spends 10-20 minutes scrolling before picking something (or giving up)
- Often watches with a partner or family — needs to find something that works for multiple people
- Values Asian content (K-dramas, anime, C-dramas) alongside Western titles
- Frustrated by US-centric recommendation tools that suggest content unavailable in their region

### Secondary Persona: "The Efficiency Seeker"
- Knows what mood they're in but not what to watch
- Wants a quick, confident recommendation — not a list of 50 options
- Would rather describe what they want in natural language than browse genre filters

## 4. Core Features (MVP — Milestone 1-3)

### 5.1 Platform Selector
- User selects which streaming platforms they subscribe to
- Persist selection in local storage so they don't re-enter every visit
- Tier 1 platforms at launch: Netflix, Disney+, Amazon Prime Video, Apple TV+, HBO Go/Max, Paramount+
- Clean, visual UI with platform logos

### 5.2 Region Detection
- Auto-detect user's country via IP geolocation (ipapi.co)
- Allow manual override (dropdown of supported countries)
- Region determines which catalog data is used for availability
- Supported regions at launch: Singapore (SG), Malaysia (MY), Indonesia (ID), Thailand (TH), Philippines (PH)
- Architecture should support easy addition of new regions

### 5.3 Conversational Recommendation Engine
- Chat-style interface — NOT a form with dropdowns
- User describes what they want in natural language:
  - Mood: "something light and funny", "intense thriller", "feel-good"
  - Time available: "30 min episode", "2-hour movie", "background show"
  - Watching with: "solo", "with my partner", "family with kids (ages 5 and 8)"
  - Preferences: "loved Severance", "no horror", "something like Ted Lasso"
- The AI should ask clarifying questions if the input is vague
- Returns 3-5 recommendations per query (not overwhelming)

### 5.4 Recommendation Cards
Each recommendation displays:
- Title and year
- TMDB rating (with star visual)
- Platform badge(s) showing where it's available
- Genre tags
- A 2-3 sentence "Why this matches" explanation personalized to the user's request
- Link to TMDB page for more info
- Poster image from TMDB

### 5.5 Follow-up Conversation
- User can respond: "not in the mood for that", "show me more like option 2", "anything newer?"
- The AI remembers the conversation context and refines recommendations
- Supports multi-turn conversation within a session

## 5. Technical Architecture

### 5.1 Frontend (React + Vite + Tailwind)
```
User Input (chat) → Frontend → Backend API → Claude API (reasoning)
                                           → TMDB API (data)
                                           → Watchmode API (supplementary)
                               ← Formatted recommendations ← 
```

### 5.2 Backend (Node.js + Express)
**API Endpoints:**

```
POST /api/recommend
  Body: { message, platforms, region, conversationHistory }
  Returns: { recommendations[], followUpMessage }

GET /api/platforms
  Query: ?region=SG
  Returns: { platforms[] } — available platforms for region

GET /api/region
  Returns: { countryCode, countryName } — auto-detected from IP

GET /api/health
  Returns: { status: "ok" }
```

### 5.3 Recommendation Flow (Backend Logic)
1. Receive user message + context (platforms, region, conversation history)
2. Send to Claude API with a system prompt that includes:
   - The user's available platforms and region
   - Instructions to suggest specific titles with reasoning
   - Guidelines for handling vague requests (ask clarifying questions)
3. Claude returns structured recommendations (title, year, why it matches)
4. For each recommended title, query TMDB API:
   - Search for the title to get TMDB ID
   - Fetch metadata (poster, rating, genres, overview)
   - Fetch watch providers for user's region
   - Filter to only platforms the user has
5. If a recommendation isn't available on user's platforms in their region, discard it and note this for Claude's next turn (so it learns to avoid unavailable content)
6. Return enriched recommendations to frontend

### 5.4 Claude API System Prompt Strategy
Store the system prompt in a separate config file (`server/config/prompts.js`) for easy iteration. The prompt should:
- Instruct Claude to act as a knowledgeable film/TV recommendation expert
- Emphasize that recommendations MUST be real titles (no hallucinated content)
- Provide the user's platform list and region as context
- Ask Claude to return structured JSON with: title, year, type (movie/series), and reasoning
- Handle edge cases: when user is vague, when no good match exists, when user rejects all suggestions

### 5.5 Data Freshness Strategy
- TMDB metadata: Cache responses for 24 hours (content metadata rarely changes)
- Watch provider data: Cache for 24 hours (aligned with JustWatch update frequency)
- Use node-cache or Redis for caching layer
- Cache key format: `{tmdb_id}:{region}:{data_type}`

## 6. Milestones

### Milestone 1: Foundation (Sessions 1-2)
**Goal:** Project scaffold + TMDB integration working

- [ ] Initialize React frontend with Vite + Tailwind
- [ ] Initialize Express backend with basic routing
- [ ] Set up environment variables and .env.example files
- [ ] Implement TMDB API service layer:
  - [ ] Search movies/TV shows by title
  - [ ] Fetch movie/show details (metadata, poster, rating)
  - [ ] Fetch watch providers by region
- [ ] Implement region detection via ipapi.co
- [ ] Build platform selector UI component
  - [ ] Visual grid with platform logos
  - [ ] Persist selection in local storage
- [ ] Build basic results card component (static data for now)
- [ ] Write tests for TMDB service layer

**Acceptance Criteria:**
- Can search TMDB and get results with Singapore availability data
- Platform selector persists between page refreshes
- Region is auto-detected correctly for Singapore IP

### Milestone 2: Conversational AI Engine (Sessions 3-4)
**Goal:** Claude-powered recommendations working end-to-end

- [ ] Implement Claude API service layer
- [ ] Design and iterate on the system prompt
- [ ] Build the `/api/recommend` endpoint with full flow:
  - [ ] Receive user message → Claude reasoning → TMDB enrichment → response
- [ ] Build chat-style UI:
  - [ ] Message input with send button
  - [ ] Conversation history display
  - [ ] Loading states while recommendations are generated
- [ ] Implement conversation memory (multi-turn within session)
- [ ] Handle Claude → TMDB validation (discard unavailable recommendations)
- [ ] Write tests for recommendation flow
- [ ] Error handling for API failures (TMDB down, Claude timeout, etc.)

**Acceptance Criteria:**
- Can have a multi-turn conversation and get relevant recommendations
- All recommendations show correct platform availability for user's region
- Unavailable titles are filtered out before reaching the user
- Graceful error states when APIs fail

### Milestone 3: Polish & Deploy (Sessions 5-7)
**Goal:** Production-ready, deployed, shareable

- [ ] Recommendation cards with full metadata:
  - [ ] Poster images, TMDB ratings, genre tags
  - [ ] Platform badges
  - [ ] "Why this matches" explanation
- [ ] Mobile-responsive design (test on common mobile viewports)
- [ ] Add caching layer for TMDB responses
- [ ] Rate limiting on backend API
- [ ] Implement "watch group" feature (optional stretch):
  - [ ] Input preferences for 2+ people
  - [ ] Find intersection recommendations
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway or Render
- [ ] Set up custom domain (optional)
- [ ] Write README with setup instructions
- [ ] Create product case study document (docs/case-study.md)

**Acceptance Criteria:**
- App is live and accessible via public URL
- Works smoothly on mobile (Singapore users are heavily mobile)
- Response time < 5 seconds for recommendation generation
- Case study documents the full product journey

## 7. Post-MVP Features (Backlog)
Prioritize based on user feedback after launch.

- [ ] Tier 2 platform support (Viu, iQIYI, meWATCH, WeTV) via Watchmode API
- [ ] User accounts with recommendation history
- [ ] "Watch group" profiles for recurring viewing partners
- [ ] Shareable recommendation links ("my friend recommended this for us")
- [ ] Trending content by region
- [ ] "Surprise me" mode for the truly indecisive
- [ ] Integration with more SEA regions (Vietnam, Myanmar, Cambodia)
- [ ] PWA support for mobile home screen installation

## 8. Product Metrics (For Case Study)
Track from day one for the portfolio case study:

- **Usage:** Total sessions, recommendations generated, messages per session
- **Engagement:** Do users send follow-up messages? How many turns per session?
- **Satisfaction:** Add a simple "Was this helpful? 👍👎" on each recommendation set
- **Platform distribution:** Which platforms are most selected? (validates Tier 2 priority)
- **Region distribution:** Where are users coming from?
- **Conversion signals:** Do users click through to TMDB pages?

## 9. User Research Plan
Conduct before and during development:

### Pre-build (5-10 interviews)
- Target: Friends/colleagues in Singapore who subscribe to 2+ platforms
- Key questions:
  - How do you currently decide what to watch?
  - How long does it usually take?
  - Have you ever given up and just rewatched something?
  - If an app could solve this, what would it need to do?
  - What streaming platforms do you have?

### Post-MVP (ongoing)
- Share with 10-20 initial users
- Collect feedback via in-app thumbs up/down + optional text feedback
- Track which recommendation styles get positive feedback
- Identify most-requested missing platforms (informs Tier 2 priority)

## 10. Design Guidelines
- **Mobile-first** — design for 375px width first, then scale up
- **Dark mode default** — aligns with the "watching TV" context
- **Conversational feel** — chat bubbles, not forms. Should feel like texting a friend who knows movies
- **Minimal cognitive load** — 3-5 recommendations max, not 20
- **Fast perceived performance** — show typing indicator while Claude generates, stream results if possible
- **Platform colors** — use each platform's brand color for badges (Netflix red, Disney+ blue, etc.)
- **Poster-forward** — movie/show posters are the most recognizable visual element, make them prominent

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude hallucates fake titles | High — breaks trust | Validate every recommendation against TMDB before showing to user |
| TMDB rate limit exceeded | Medium — app stops working | Implement caching + rate limiting on backend |
| Regional availability data is wrong | Medium — user frustration | Show disclaimer "availability may vary" + link to TMDB for verification |
| Slow response time (Claude + TMDB calls) | Medium — poor UX | Show typing indicator, optimize with parallel TMDB calls, cache aggressively |
| TMDB API changes or goes down | Low but critical | Abstract TMDB calls behind service layer for easy swap; implement fallback messaging |
| Users only care about Netflix | Low — limits product scope | Validate in user interviews; if true, simplify MVP to Netflix-only and add platforms later |
