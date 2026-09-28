import assert from "node:assert/strict"
import test from "node:test"
import { createApp, type Deps } from "./app.ts"
import type { Config } from "./config.ts"
import { memoryStore } from "./sessions.ts"
import { createWatchlistCache } from "./watchlist-cache.ts"
import { TmdbError, type Tmdb } from "./watchlist.ts"

const config: Config = { tmdbApiKey: "tmdb", openRouterKey: "router", envSession: null }

const heat = { id: 1, name: "Heat", poster: null, overview: "A heist." }
const brick = { id: 2, name: "Brick", poster: null, overview: "A noir." }

function fakeTmdb(overrides: Partial<Tmdb> = {}): Tmdb {
  return {
    authorizeUrl: (token, redirectTo) =>
      `https://tmdb.test/authenticate/${token}?redirect_to=${encodeURIComponent(redirectTo)}`,
    createRequestToken: async () => "tok-1",
    createSession: async (token) => `sid-for-${token}`,
    deleteSession: async () => {},
    fetchWatchlist: async (_sessionId, onPage) => {
      onPage?.([heat, brick])
      return [heat, brick]
    },
    ...overrides,
  }
}

function makeApp(overrides: Partial<Deps> = {}, configOverrides: Partial<Config> = {}) {
  return createApp(
    { ...config, ...configOverrides },
    { tmdb: fakeTmdb(), ask: () => async () => "0", sessions: memoryStore(), watchlists: createWatchlistCache(), ...overrides },
  )
}

type App = ReturnType<typeof makeApp>

async function connect(app: App) {
  await app.request("/api/connect", { method: "POST" })
  const back = await app.request("/api/auth/callback?request_token=tok-1&approved=true")
  assert.equal(back.headers.get("location"), "/")
}

async function health(app: App) {
  return (await app.request("/api/health")).json()
}

test("the app starts disconnected", async () => {
  assert.deepEqual(await health(makeApp()), { connected: false })
})

test("approving TMDB connects", async () => {
  const app = makeApp()
  await connect(app)
  assert.deepEqual(await health(app), { connected: true })
})

test("TMDB_SESSION_ID connects without approval", async () => {
  assert.deepEqual(await health(makeApp({}, { envSession: "env-sid" })), { connected: true })
})

test("the approval link returns to this server", async () => {
  const response = await makeApp().request("/api/connect", { method: "POST" })
  const { url } = (await response.json()) as { url: string }
  assert.ok(url.endsWith(encodeURIComponent("http://localhost/api/auth/callback")))
})

test("a request token this server did not issue is refused", async () => {
  const unasked = await makeApp().request("/api/auth/callback?request_token=tok-1")
  assert.equal(unasked.headers.get("location"), "/?auth=denied")
  const app = makeApp()
  await app.request("/api/connect", { method: "POST" })
  const forged = await app.request("/api/auth/callback?request_token=other")
  assert.equal(forged.headers.get("location"), "/?auth=denied")
})

test("a declined approval is reported", async () => {
  const app = makeApp()
  await app.request("/api/connect", { method: "POST" })
  const response = await app.request("/api/auth/callback?request_token=tok-1&approved=false")
  assert.equal(response.headers.get("location"), "/?auth=denied")
})

test("the watchlist needs a connection", async () => {
  assert.equal((await makeApp().request("/api/watchlist")).status, 401)
})

test("the watchlist streams one line per page", async () => {
  const app = makeApp()
  await connect(app)
  const response = await app.request("/api/watchlist")
  assert.equal(response.headers.get("content-type"), "application/x-ndjson")
  const lines = (await response.text()).trim().split("\n")
  assert.deepEqual(JSON.parse(lines[0]!), { films: [heat, brick] })
})

async function moodRequest(app: App, body: unknown) {
  return app.request("/api/mood", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("a mood needs a connection", async () => {
  const response = await moodRequest(makeApp(), { mood: "tense" })
  assert.equal(response.status, 401)
})

test("an empty mood is refused", async () => {
  const app = makeApp()
  await connect(app)
  const response = await moodRequest(app, { mood: " " })
  assert.equal(response.status, 400)
})

test("the mood is matched against the server's watchlist, not the request", async () => {
  const seen: string[][] = []
  const app = makeApp({
    ask: () => async (criteria) => {
      seen.push(Object.values(criteria))
      return "1"
    },
  })
  await connect(app)
  const response = await moodRequest(app, { mood: "noir", films: [{ name: "Injected" }] })
  assert.deepEqual(await response.json(), { film: brick })
  assert.ok(seen[0]!.some((text) => text.startsWith("Heat")))
  assert.ok(!seen[0]!.some((text) => text.startsWith("Injected")))
})

test("excluded films are not offered again", async () => {
  const offered: string[] = []
  const app = makeApp({
    ask: () => async (criteria) => {
      offered.push(...Object.values(criteria))
      return "0"
    },
  })
  await connect(app)
  const response = await moodRequest(app, { mood: "noir", exclude: [1] })
  assert.deepEqual(await response.json(), { film: brick })
  assert.ok(!offered.some((text) => text.startsWith("Heat")))
})

test("the watchlist is fetched once for the stream and the spin", async () => {
  let fetches = 0
  const app = makeApp({
    tmdb: fakeTmdb({
      fetchWatchlist: async (_sid, onPage) => {
        fetches += 1
        onPage?.([heat])
        return [heat]
      },
    }),
  })
  await connect(app)
  await (await app.request("/api/watchlist")).text()
  await moodRequest(app, { mood: "tense" })
  assert.equal(fetches, 1)
})

test("disconnecting ends the TMDB session and forgets it locally", async () => {
  const deleted: string[] = []
  const app = makeApp({
    tmdb: fakeTmdb({
      deleteSession: async (sid) => {
        deleted.push(sid)
      },
    }),
  })
  await connect(app)
  const response = await app.request("/api/disconnect", { method: "POST" })
  assert.deepEqual(await response.json(), { connected: false })
  assert.deepEqual(deleted, ["sid-for-tok-1"])
  assert.deepEqual(await health(app), { connected: false })
})

test("disconnecting still works when TMDB is down", async () => {
  const app = makeApp({
    tmdb: fakeTmdb({
      deleteSession: async () => {
        throw new Error("down")
      },
    }),
  })
  await connect(app)
  const response = await app.request("/api/disconnect", { method: "POST" })
  assert.equal(response.status, 200)
})

test("a revoked TMDB session sends the visitor back to Connect", async () => {
  const app = makeApp({
    tmdb: fakeTmdb({
      fetchWatchlist: async () => {
        throw new TmdbError("TMDB rejected the credentials.", 401)
      },
    }),
  })
  await connect(app)
  const response = await moodRequest(app, { mood: "tense" })
  assert.equal(response.status, 401)
  assert.deepEqual(await health(app), { connected: false })
})
