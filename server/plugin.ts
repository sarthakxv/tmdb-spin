import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { readSession, writeSession } from "./session"
import { createRequestToken, createSession, fetchWatchlist, TmdbError } from "./watchlist"

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

export function tmdbPlugin(apiKey: string, envSession: string | undefined): Plugin {
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
