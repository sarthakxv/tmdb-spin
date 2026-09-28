import assert from "node:assert/strict"
import test from "node:test"
import { collectWatchlist, createTmdb, retryDelay, TmdbError, toDetails, toFilm } from "./watchlist.ts"

test("a watchlist movie becomes a title and poster", () => {
  const film = toFilm(
    {
      id: 1,
      title: "Chronicle",
      poster_path: "/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
    },
    "movie",
  )
  assert.deepEqual(film, {
    id: 1,
    name: "Chronicle",
    poster: "/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
    overview: "",
    year: null,
    genreIds: [],
    media: "movie",
  })
  assert.deepEqual(Object.keys(film ?? {}), ["id", "name", "poster", "overview", "year", "genreIds", "media"])
})

test("a synopsis is kept for mood matching", () => {
  assert.equal(
    toFilm({ id: 2, title: "Past Lives", poster_path: null, overview: "  Two people meet again. " }, "movie")?.overview,
    "Two people meet again.",
  )
})

test("missing posters stay blank", () => {
  assert.deepEqual(toFilm({ id: 3, title: "Haywire", poster_path: null, release_date: "2012-02-01", genre_ids: [878] }, "movie"), {
    id: 3,
    name: "Haywire",
    poster: null,
    overview: "",
    year: 2012,
    genreIds: [878],
    media: "movie",
  })
  assert.equal(toFilm({ title: "  " }, "movie"), null)
})

test("pages are walked until the watchlist ends", async () => {
  const films = await collectWatchlist(async (page) => {
    if (page === 1) {
      return { total_pages: 2, results: [{ id: 1, title: "Chronicle", poster_path: "/a.jpg" }] }
    }
    return { total_pages: 2, results: [{ id: 2, title: "Haywire", poster_path: null }] }
  }, "movie")
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
    "movie",
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
  assert.equal(toFilm({ title: "Heat" }, "movie"), null)
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

test("details keep the facts the reveal shows", () => {
  const details = toDetails(
    {
      id: 949,
      release_date: "1995-12-15",
      runtime: 170,
      vote_average: 7.94,
      vote_count: 7000,
      genres: [{ name: "Crime" }, { name: "Drama" }, { name: "Action" }, { name: "Thriller" }],
      overview: " A heist. ",
      videos: {
        results: [
          { site: "YouTube", type: "Teaser", key: "t" },
          { site: "YouTube", type: "Trailer", key: "x", official: false },
          { site: "YouTube", type: "Trailer", key: "y", official: true },
        ],
      },
      "watch/providers": {
        results: {
          IN: { link: "https://tmdb/watch", flatrate: [{ provider_name: "Netflix", logo_path: "/n.png" }] },
        },
      },
    },
    "movie",
    "IN",
  )
  assert.deepEqual(details, {
    id: 949,
    year: 1995,
    runtime: 170,
    rating: 7.9,
    genres: ["Crime", "Drama", "Action"],
    overview: "A heist.",
    trailer: "https://www.youtube.com/watch?v=y",
    providers: [{ name: "Netflix", logo: "https://image.tmdb.org/t/p/w92/n.png" }],
    watchLink: "https://tmdb/watch",
    link: "https://www.themoviedb.org/movie/949",
  })
})

test("thin data stays empty rather than wrong", () => {
  const details = toDetails({ id: 1, vote_average: 9, vote_count: 3 }, "movie", "US")
  assert.equal(details.year, null)
  assert.equal(details.rating, null)
  assert.equal(details.trailer, null)
  assert.deepEqual(details.providers, [])
})

test("removing posts watchlist false for the account", async () => {
  const { fetch, calls } = scripted(reply(200, { id: 42 }), reply(200, { success: true }))
  await createTmdb("key", { fetch }).setWatchlist("sid", "movie", 949, false)
  assert.ok(calls[1]!.url.startsWith("https://api.themoviedb.org/3/account/42/watchlist"))
  assert.equal(calls[1]!.init?.method, "POST")
  assert.equal(calls[1]!.init?.body, JSON.stringify({ media_type: "movie", media_id: 949, watchlist: false }))
})

test("a TV show uses its name and first air date", () => {
  const show = toFilm({ id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17", genre_ids: [18] }, "tv")
  assert.equal(show?.name, "Game of Thrones")
  assert.equal(show?.year, 2011)
  assert.equal(show?.media, "tv")
})

test("the TV watchlist has its own endpoint", async () => {
  const { fetch, calls } = scripted(reply(200, { id: 42 }), reply(200, { total_pages: 1, results: [] }))
  await createTmdb("key", { fetch }).fetchWatchlist("sid", "tv")
  assert.ok(calls[1]!.url.startsWith("https://api.themoviedb.org/3/account/42/watchlist/tv"))
})

test("TV details use the episode runtime", () => {
  const details = toDetails({ id: 1399, first_air_date: "2011-04-17", episode_run_time: [57] }, "tv", "US")
  assert.equal(details.year, 2011)
  assert.equal(details.runtime, 57)
  assert.equal(details.link, "https://www.themoviedb.org/tv/1399")
})

test("the approval link returns to the app", () => {
  assert.equal(
    createTmdb("key").authorizeUrl("tok", "https://spin.example/api/auth/callback"),
    "https://www.themoviedb.org/authenticate/tok?redirect_to=https%3A%2F%2Fspin.example%2Fapi%2Fauth%2Fcallback",
  )
})
