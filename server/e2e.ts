import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { createApp } from "./app.ts"
import { fakeAsk, fakeTmdb } from "./fakes.ts"
import { memoryStore } from "./sessions.ts"
import { createWatchlistCache } from "./watchlist-cache.ts"

const appUrl = "http://localhost:4173"
const app = createApp(
  { tmdbApiKey: "fake", openRouterKey: "fake", envSession: null },
  { tmdb: fakeTmdb(appUrl), ask: fakeAsk, sessions: memoryStore(), watchlists: createWatchlistCache() },
)
app.use("*", serveStatic({ root: "./dist" }))
app.get("*", serveStatic({ path: "./dist/index.html" }))
serve({ fetch: app.fetch, port: 4173 })
