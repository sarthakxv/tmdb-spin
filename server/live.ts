import type { Deps } from "./app.ts"
import type { Config } from "./config.ts"
import { jevAsk } from "./jev.ts"
import { fileStore } from "./sessions.ts"
import { createTmdb } from "./watchlist.ts"

export function liveDeps(config: Config): Deps {
  return {
    tmdb: createTmdb(config.tmdbApiKey),
    ask: (mood) => jevAsk(config.openRouterKey, mood),
    sessions: fileStore(".tmdb-session"),
  }
}
