# What Should I Watch?

## Project Overview
A conversational AI-powered recommendation tool that helps users decide what to watch across multiple streaming platforms. Unlike traditional recommender systems that are siloed to a single platform, this tool answers the real question: "Given my mood, my time, who I'm watching with, and which platforms I have — what should I watch right now?"

Primary market: Singapore and Southeast Asia, with architecture designed for regional expansion.

## Tech Stack
- **Frontend**: React 18+ with Vite, Tailwind CSS for styling
- **Backend**: Node.js + Express
- **AI Engine**: Claude API (Anthropic) for conversational recommendation logic
- **Content Data**: TMDB API for movie/TV metadata (titles, genres, ratings, descriptions, images)
- **Platform Availability**: TMDB Watch Providers (powered by JustWatch) for streaming platform availability by region
- **Supplementary Availability**: Watchmode API (free tier) for regional SEA platforms not covered by TMDB/JustWatch
- **Geolocation**: ipapi.co (free tier) for auto-detecting user region
- **Deployment**: Vercel (frontend) + Railway or Render (backend)
- **Version Control**: Git + GitHub

## Key Architecture Decisions
- TMDB is the single source of truth for content metadata
- Platform availability is region-aware — all TMDB watch provider calls include `watch_region` parameter (ISO 3166-1 codes: SG, MY, ID, TH, PH, etc.)
- TMDB data from JustWatch updates every ~24-32 hours — this is acceptable for our use case
- Claude API handles the conversational UX and recommendation reasoning — it receives structured TMDB data and generates personalized recommendations with explanations
- The app does NOT build its own recommendation model — it leverages Claude's reasoning over TMDB metadata

## Tiered Platform Strategy
### Tier 1 — Full TMDB/JustWatch coverage (launch platforms):
- Netflix, Disney+, Amazon Prime Video, Apple TV+, HBO Go/Max, Paramount+

### Tier 2 — Add post-MVP based on user demand:
- Viu, iQIYI, meWATCH, WeTV
- These may require Watchmode API or manual curation for availability data

## Code Style & Conventions
- Use functional React components with hooks (no class components)
- ES modules throughout (import/export, not require)
- Keep components small and single-purpose (max ~150 lines per file)
- Use async/await for all asynchronous operations (no raw .then() chains)
- All API keys stored in .env files — NEVER committed to git
- Use descriptive variable names — prioritize readability over brevity
- Error handling on every API call — always handle loading, success, and error states
- Comments should explain "why", not "what"

## Project Structure
```
what-should-i-watch/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API service layer (TMDB, backend calls)
│   │   ├── utils/           # Helper functions
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
├── server/                  # Express backend
│   ├── routes/              # API route handlers
│   ├── services/            # Business logic (TMDB service, Claude service)
│   ├── middleware/           # Error handling, rate limiting
│   ├── utils/               # Helper functions
│   ├── .env.example
│   └── package.json
├── docs/                    # Project documentation
│   └── case-study.md        # Product case study (for portfolio)
├── spec.md                  # Product specification
├── CLAUDE.md                # This file
└── README.md
```

## Common Commands
```bash
# Development
cd client && npm run dev          # Start frontend dev server
cd server && npm run dev          # Start backend dev server (with nodemon)

# Testing
cd client && npm run test         # Run frontend tests
cd server && npm run test         # Run backend tests

# Linting
npm run lint                      # Run ESLint across project

# Build
cd client && npm run build        # Production build
```

## Environment Variables
### Client (.env)
```
VITE_API_BASE_URL=http://localhost:3001
```

### Server (.env)
```
TMDB_API_KEY=your_tmdb_api_key
TMDB_API_BASE_URL=https://api.themoviedb.org/3
ANTHROPIC_API_KEY=your_anthropic_api_key
WATCHMODE_API_KEY=your_watchmode_api_key
IPAPI_BASE_URL=https://ipapi.co
PORT=3001
```

## Important Notes for Claude Code
- Always check that API keys are not hardcoded anywhere — use environment variables
- When making TMDB API calls, always include the `watch_region` parameter for availability queries
- The Claude API integration should use the Messages API with claude-sonnet-4-5-20250929 model
- Keep Claude API prompts in a separate config file for easy iteration
- When generating recommendations, always include: title, platform(s), a brief "why this matches" explanation, and the TMDB rating
- Mobile-first responsive design — many SEA users browse on mobile
- Handle API rate limits gracefully (TMDB free tier: ~40 requests per 10 seconds)
