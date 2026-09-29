# Cineroulette

Spin your TMDB movie watchlist. Type a mood, and [Jev](https://openrouter.ai) picks the film that fits. The carousel lands on that title.

## Setup

You need Node.js 22 or newer.

```sh
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | What it is |
| --- | --- | --- |
| `TMDB_API_KEY` | yes | API Read Access Token or v3 key from [TMDB](https://www.themoviedb.org/settings/api) |
| `OPENROUTER_API_KEY` | yes, to spin | Key from [OpenRouter](https://openrouter.ai/settings/keys) |
| `TMDB_SESSION_ID` | no | Skip the in-app approval if you already have a session id |

```sh
npm run dev
```

Open the URL Vite prints. The first time, click **Connect** and approve the app on TMDB. The server writes that session to `.tmdb-session` (mode `600`, gitignored). Restart after you change `.env`.

## Scripts

- `npm run dev` starts the app and the local API
- `npm test` runs the spin, watchlist, and mood tests
- `npm run build` typechecks and builds the client
- `npm run preview` serves the production build with the same API

## What stays local

The TMDB key, OpenRouter key, and session id stay on this machine. The server sends film titles and short overviews to OpenRouter when you spin. Posters load from TMDB.
