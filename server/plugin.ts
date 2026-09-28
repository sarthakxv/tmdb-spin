import type { IncomingMessage, ServerResponse } from "node:http"
import { APICallError } from "ai"
import type { Plugin } from "vite"
import { jevAsk } from "./jev.ts"
import { MoodError, selectByMood, type MoodFilm } from "./mood.ts"
import { readSession, writeSession } from "./session.ts"
import { createRequestToken, createSession, fetchWatchlist, TmdbError } from "./watchlist.ts"

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(body))
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302
  res.setHeader("location", location)
  res.end()
}

function originOf(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost:5173"
  return `http://${host}`
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new MoodError("That watchlist is too long to match.", 400))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown)
      } catch {
        reject(new MoodError("Enter a mood.", 400))
      }
    })
    req.on("error", reject)
  })
}

function filmsFrom(body: unknown): MoodFilm[] | null {
  if (!body || typeof body !== "object" || !("films" in body) || !Array.isArray(body.films)) return null
  const films: MoodFilm[] = []
  for (const film of body.films) {
    if (!film || typeof film !== "object" || !("name" in film) || typeof film.name !== "string") continue
    const name = film.name.trim()
    if (!name) continue
    const overview = "overview" in film && typeof film.overview === "string" ? film.overview : ""
    films.push({ name, overview })
  }
  return films
}

export function tmdbPlugin(apiKey: string, envSession: string | undefined, openRouterKey = ""): Plugin {
  let pendingToken: string | null = null

  const handle = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const path = url.pathname
    if (!path.startsWith("/api/")) return next()

    try {
      if (path === "/api/health" && req.method === "GET") {
        send(res, 200, { configured: apiKey.length > 0, connected: Boolean(readSession(envSession)) })
        return
      }

      if (path === "/api/mood" && req.method === "POST") {
        if (!openRouterKey.trim()) {
          send(res, 503, { error: "Add OPENROUTER_API_KEY to .env and restart." })
          return
        }
        const body = await readJson(req)
        const mood = body && typeof body === "object" && "mood" in body && typeof body.mood === "string" ? body.mood.trim() : ""
        if (!mood) {
          send(res, 400, { error: "Enter a mood." })
          return
        }
        if (mood.length > 300) {
          send(res, 400, { error: "Keep the mood to a sentence." })
          return
        }
        const films = filmsFrom(body)
        if (!films || films.length === 0) {
          send(res, 400, { error: "The watchlist is empty." })
          return
        }
        if (films.length > 2000) {
          send(res, 400, { error: "That watchlist is too long to match." })
          return
        }
        const index = await selectByMood(films, jevAsk(openRouterKey.trim(), mood))
        if (index == null) {
          send(res, 200, { match: false })
          return
        }
        send(res, 200, { index })
        return
      }

      if (!apiKey) {
        send(res, 503, { error: "TMDB_API_KEY is missing from .env." })
        return
      }

      if (path === "/api/connect" && req.method === "POST") {
        pendingToken = await createRequestToken(apiKey)
        const redirectTo = `${originOf(req)}/api/auth/callback`
        send(res, 200, {
          url: `https://www.themoviedb.org/authenticate/${pendingToken}?redirect_to=${encodeURIComponent(redirectTo)}`,
        })
        return
      }

      if (path === "/api/auth/callback" && req.method === "GET") {
        if (url.searchParams.get("approved") === "false") {
          redirect(res, "/?auth=denied")
          return
        }
        const token = url.searchParams.get("request_token") || pendingToken
        if (!token) {
          redirect(res, "/?auth=denied")
          return
        }
        writeSession(await createSession(apiKey, token))
        pendingToken = null
        redirect(res, "/")
        return
      }

      if (path === "/api/watchlist" && req.method === "GET") {
        const sessionId = readSession(envSession)
        if (!sessionId) {
          send(res, 401, { error: "Connect TMDB to read the watchlist." })
          return
        }
        res.statusCode = 200
        res.setHeader("content-type", "application/x-ndjson")
        res.setHeader("cache-control", "no-cache, no-transform")
        res.flushHeaders()
        try {
          await fetchWatchlist(apiKey, sessionId, (films) => {
            res.write(`${JSON.stringify({ films })}\n`)
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "TMDB could not complete that request."
          res.write(`${JSON.stringify({ error: message })}\n`)
        }
        res.end()
        return
      }
    } catch (error) {
      if (res.headersSent || res.writableEnded) {
        res.end()
        return
      }
      if (path === "/api/mood") {
        if (error instanceof MoodError) {
          send(res, error.status, { error: error.message })
          return
        }
        if (error instanceof APICallError && error.statusCode === 401) {
          send(res, 401, { error: "Jev rejected OPENROUTER_API_KEY." })
          return
        }
        send(res, 502, { error: "Jev could not pick a movie." })
        return
      }
      const message = error instanceof Error ? error.message : "TMDB could not complete that request."
      const status = error instanceof TmdbError ? error.status : 502
      if (path === "/api/auth/callback") {
        redirect(res, `/?auth=denied`)
        return
      }
      send(res, status, { error: message })
      return
    }

    next()
  }

  return {
    name: "tmdb-watchlist",
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
