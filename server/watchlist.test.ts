import assert from "node:assert/strict"
import test from "node:test"
import { collectWatchlist, createTmdb, retryDelay, TmdbError, toFilm } from "./watchlist.ts"

test("a watchlist movie becomes a title and poster", () => {
  const film = toFilm({
    id: 1,
    title: "Chronicle",
    poster_path: "/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
  })
  assert.deepEqual(film, {
    id: 1,
    name: "Chronicle",
    poster: "https://image.tmdb.org/t/p/w500/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
    overview: "",
  })
  assert.deepEqual(Object.keys(film ?? {}), ["id", "name", "poster", "overview"])
})

test("a synopsis is kept for mood matching", () => {
  assert.equal(
    toFilm({ id: 2, title: "Past Lives", poster_path: null, overview: "  Two people meet again. " })?.overview,
    "Two people meet again.",
  )
})

test("missing posters stay blank", () => {
  assert.deepEqual(toFilm({ id: 3, title: "Haywire", poster_path: null }), {
    id: 3,
    name: "Haywire",
    poster: null,
    overview: "",
  })
  assert.equal(toFilm({ title: "  " }), null)
})

test("pages are walked until the watchlist ends", async () => {
  const films = await collectWatchlist(async (page) => {
    if (page === 1) {
      return { total_pages: 2, results: [{ id: 1, title: "Chronicle", poster_path: "/a.jpg" }] }
    }
    return { total_pages: 2, results: [{ id: 2, title: "Haywire", poster_path: null }] }
  })
  assert.deepEqual(
    films.map((film) => film.name),
    ["Chronicle", "Haywire"],
  )
})

test("a page is delivered before the next page is requested", async () => {
  const delivered: string[] = []
  let releaseNext: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    releaseNext = resolve
  })
  const films = await collectWatchlist(
    async (page) => {
      if (page === 1) return { total_pages: 2, results: [{ id: 1, title: "Chronicle", poster_path: "/a.jpg" }] }
      await gate
      return { total_pages: 2, results: [{ id: 2, title: "Haywire", poster_path: null }] }
    },
    (pageFilms) => {
      delivered.push(pageFilms.map((film) => film.name).join(","))
      if (delivered.length === 1) releaseNext()
    },
  )
  assert.deepEqual(delivered, ["Chronicle", "Haywire"])
  assert.deepEqual(
    films.map((film) => film.name),
    ["Chronicle", "Haywire"],
  )
})

function reply(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
}

function scripted(...responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const next = responses.shift()
    if (!next) throw new Error("no scripted response left")
    return next
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

test("a movie without an id is skipped", () => {
  assert.equal(toFilm({ title: "Heat" }), null)
})

test("a rate-limited request waits for Retry-After and tries again", async () => {
  const { fetch, calls } = scripted(
    reply(429, {}, { "retry-after": "2" }),
    reply(200, { success: true, request_token: "tok" }),
  )
  const waits: number[] = []
  const tmdb = createTmdb("key", {
    fetch,
    sleep: async (ms) => {
      waits.push(ms)
    },
  })
  assert.equal(await tmdb.createRequestToken(), "tok")
  assert.equal(calls.length, 2)
  assert.deepEqual(waits, [2000])
})

test("waits back off when TMDB gives no Retry-After", () => {
  assert.equal(retryDelay(null, 0), 500)
  assert.equal(retryDelay(null, 2), 2000)
  assert.equal(retryDelay(reply(429, {}, { "retry-after": "999" }), 0), 10_000)
})

test("TMDB outages give up after the retries run out", async () => {
  const { fetch, calls } = scripted(reply(503), reply(503), reply(503), reply(503))
  const tmdb = createTmdb("key", { fetch, sleep: async () => {} })
  await assert.rejects(tmdb.createRequestToken(), (error) => error instanceof TmdbError && error.status === 503)
  assert.equal(calls.length, 4)
})

test("rejected credentials are not retried", async () => {
  const { fetch, calls } = scripted(reply(401))
  const tmdb = createTmdb("key", { fetch, sleep: async () => {} })
  await assert.rejects(tmdb.createRequestToken(), (error) => error instanceof TmdbError && error.status === 401)
  assert.equal(calls.length, 1)
})

test("disconnecting deletes the TMDB session", async () => {
  const { fetch, calls } = scripted(reply(200, { success: true }))
  await createTmdb("key", { fetch }).deleteSession("sid")
  assert.ok(calls[0]!.url.startsWith("https://api.themoviedb.org/3/authentication/session"))
  assert.equal(calls[0]!.init?.method, "DELETE")
  assert.equal(calls[0]!.init?.body, JSON.stringify({ session_id: "sid" }))
})

test("the approval link returns to the app", () => {
  assert.equal(
    createTmdb("key").authorizeUrl("tok", "https://spin.example/api/auth/callback"),
    "https://www.themoviedb.org/authenticate/tok?redirect_to=https%3A%2F%2Fspin.example%2Fapi%2Fauth%2Fcallback",
  )
})
