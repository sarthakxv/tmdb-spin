import { APICallError } from "ai"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { stream } from "hono/streaming"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Film, FilmDetails, Media } from "../shared/types.ts"
import type { Config } from "./config.ts"
import { type Ask, MoodError, selectByMood, strengthOf } from "./mood.ts"
import { LOCAL_SESSION, type Session, type SessionStore } from "./sessions.ts"
import { createTtlCache } from "./ttl-cache.ts"
import type { WatchlistCache } from "./watchlist-cache.ts"
import { type Tmdb, TmdbError } from "./watchlist.ts"

export type Deps = {
  tmdb: Tmdb
  ask: (mood: string) => Ask
  sessions: SessionStore
  watchlists: WatchlistCache
}

export type AppEnv = { Variables: { session: Session } }

function tmdbMessage(error: unknown) {
  return error instanceof TmdbError ? error.message : "TMDB could not complete that request."
}

const MEDIA = new Set<Media>(["movie"])

export function createApp(config: Config, deps: Deps) {
  const app = new Hono<AppEnv>()
  const details = createTtlCache<FilmDetails>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 2000 })

  app.use("/api/*", async (c, next) => {
    const stored = deps.sessions.get(LOCAL_SESSION)
    c.set("session", {
      id: LOCAL_SESSION,
      tmdbSessionId: config.envSession ?? stored?.tmdbSessionId ?? null,
      requestToken: stored?.requestToken ?? null,
    })
    await next()
  })

  function forget(session: Session) {
    deps.watchlists.drop(session.id)
    deps.sessions.delete(session.id)
  }

  app.get("/api/health", (c) => c.json({ connected: Boolean(c.get("session").tmdbSessionId) }))

  app.post("/api/disconnect", async (c) => {
    const session = c.get("session")
    if (session.tmdbSessionId && session.tmdbSessionId !== config.envSession) {
      await deps.tmdb.deleteSession(session.tmdbSessionId).catch(() => {})
    }
    forget(session)
    return c.json({ connected: false })
  })

  app.post("/api/connect", async (c) => {
    const requestToken = await deps.tmdb.createRequestToken()
    deps.sessions.save({ ...c.get("session"), requestToken })
    const callback = `${new URL(c.req.url).origin}/api/auth/callback`
    return c.json({ url: deps.tmdb.authorizeUrl(requestToken, callback) })
  })

  app.get("/api/auth/callback", async (c) => {
    const session = c.get("session")
    const token = c.req.query("request_token")
    if (c.req.query("approved") === "false" || !token || token !== session.requestToken) {
      return c.redirect("/?auth=denied")
    }
    try {
      const tmdbSessionId = await deps.tmdb.createSession(token)
      deps.sessions.save({ ...session, tmdbSessionId, requestToken: null })
      return c.redirect("/")
    } catch {
      return c.redirect("/?auth=denied")
    }
  })

  function watchlistFor(session: Session, onPage?: (films: Film[]) => void) {
    const tmdbSessionId = session.tmdbSessionId
    if (!tmdbSessionId) throw new TmdbError("Connect TMDB to read the watchlist.", 401)
    return deps.watchlists.load(session.id, (page) => deps.tmdb.fetchWatchlist(tmdbSessionId, page), onPage)
  }

  app.get("/api/watchlist", (c) => {
    const session = c.get("session")
    if (!session.tmdbSessionId) return c.json({ error: "Connect TMDB to read the watchlist." }, 401)
    if (c.req.query("refresh") === "1") deps.watchlists.drop(session.id)
    c.header("content-type", "application/x-ndjson")
    c.header("cache-control", "no-cache, no-transform")
    return stream(c, async (out) => {
      let queue = Promise.resolve()
      const write = (line: unknown) => {
        queue = queue.then(() => out.write(`${JSON.stringify(line)}\n`)).then(() => {})
      }
      try {
        await watchlistFor(session, (films) => write({ films }))
      } catch (error) {
        if (error instanceof TmdbError && error.status === 401) forget(session)
        write({ error: tmdbMessage(error) })
      }
      await queue
    })
  })

  app.post(
    "/api/mood",
    bodyLimit({ maxSize: 20_000, onError: (c) => c.json({ error: "Keep the mood to a sentence." }, 413) }),
    async (c) => {
      const session = c.get("session")
      if (!session.tmdbSessionId) return c.json({ error: "Connect TMDB to read the watchlist." }, 401)
      const body = (await c.req.json().catch(() => null)) as { mood?: unknown; exclude?: unknown } | null
      const mood = typeof body?.mood === "string" ? body.mood.trim() : ""
      if (!mood) return c.json({ error: "Enter a mood." }, 400)
      if (mood.length > 300) return c.json({ error: "Keep the mood to a sentence." }, 400)
      const exclude = new Set(
        Array.isArray(body?.exclude) ? body.exclude.filter((id): id is number => Number.isInteger(id)) : [],
      )
      const films = await watchlistFor(session)
      const candidates = films.filter((film) => !exclude.has(film.id))
      if (candidates.length === 0) return c.json({ match: false })
      try {
        const pick = await selectByMood(candidates, deps.ask(mood))
        return pick == null ? c.json({ match: false }) : c.json({ film: candidates[pick.index], strength: strengthOf(pick.probability) })
      } catch (error) {
        if (error instanceof MoodError) return c.json({ error: error.message }, error.status as ContentfulStatusCode)
        if (error instanceof APICallError && error.statusCode === 401) {
          return c.json({ error: "Jev rejected OPENROUTER_API_KEY." }, 401)
        }
        return c.json({ error: "Jev could not pick a movie." }, 502)
      }
    },
  )

  app.get("/api/titles/:media/:id", async (c) => {
    if (!c.get("session").tmdbSessionId) return c.json({ error: "Connect TMDB to read the watchlist." }, 401)
    const media = c.req.param("media") as Media
    const id = Number(c.req.param("id"))
    if (!MEDIA.has(media) || !Number.isInteger(id) || id <= 0) return c.json({ error: "Unknown title." }, 400)
    const asked = c.req.query("region")?.toUpperCase() ?? ""
    const region = /^[A-Z]{2}$/.test(asked) ? asked : "US"
    const key = `${media}:${id}:${region}`
    const cached = details.get(key)
    if (cached) return c.json(cached)
    const fresh = await deps.tmdb.titleDetails(media, id, region)
    details.set(key, fresh)
    return c.json(fresh)
  })

  app.onError((error, c) => {
    if (error instanceof TmdbError && error.status === 401) {
      const session = c.get("session")
      if (session) forget(session)
      return c.json({ error: "TMDB access ended. Connect again." }, 401)
    }
    if (error instanceof TmdbError) return c.json({ error: error.message }, 502)
    return c.json({ error: "Something went wrong." }, 500)
  })

  return app
}
