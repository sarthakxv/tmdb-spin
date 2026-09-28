import type { IncomingMessage, ServerResponse } from "node:http"
import { getRequestListener } from "@hono/node-server"
import type { Plugin } from "vite"

type FetchApp = { fetch: (request: Request) => Response | Promise<Response> }

export function apiPlugin(app: FetchApp): Plugin {
  const listener = getRequestListener(app.fetch)
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/api/")) return next()
    void listener(req, res)
  }
  return {
    name: "watchlist-api",
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
