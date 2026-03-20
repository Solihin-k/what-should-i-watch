# What Should I Watch?

An AI-powered recommendation tool that helps you decide what to watch across all your streaming platforms, based on your mood, who you're watching with, and how much time you have.

## Live Demo

<!-- TODO: Add live URL after deployment -->

## Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS
- **Backend**: Node.js + Express
- **AI**: Claude API (Anthropic) for conversational recommendations
- **Content Data**: TMDB API for metadata, JustWatch for streaming availability
- **Deployment**: Vercel (frontend) + Render (backend)

## Local Development

### Prerequisites

- Node.js 18+
- TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/what-should-i-watch.git
   cd what-should-i-watch
   ```

2. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

3. Configure environment variables:
   ```bash
   # server/.env
   cp server/.env.example server/.env
   # Fill in your API keys

   # client/.env
   cp client/.env.example client/.env
   ```

4. Start development servers:
   ```bash
   # Terminal 1 — backend
   cd server && npm run dev

   # Terminal 2 — frontend
   cd client && npm run dev
   ```

5. Open http://localhost:5173

## Screenshot

<!-- TODO: Add screenshot -->
