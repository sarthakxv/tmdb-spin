import assert from "node:assert/strict"
import test from "node:test"
import { collectWatchlist, toFilm } from "./watchlist.ts"

test("a watchlist movie becomes a title and poster", () => {
  const film = toFilm({
    title: "Chronicle",
    poster_path: "/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
  })
  assert.deepEqual(film, {
    name: "Chronicle",
    poster: "https://image.tmdb.org/t/p/w500/xENglsVIIWEEhhB5lgpy33tGcKI.jpg",
    overview: "",
  })
  assert.deepEqual(Object.keys(film ?? {}), ["name", "poster", "overview"])
})

test("a synopsis is kept for mood matching", () => {
  assert.equal(
    toFilm({ title: "Past Lives", poster_path: null, overview: "  Two people meet again. " })?.overview,
    "Two people meet again.",
  )
})

test("missing posters stay blank", () => {
  assert.deepEqual(toFilm({ title: "Haywire", poster_path: null }), {
    name: "Haywire",
    poster: null,
    overview: "",
  })
  assert.equal(toFilm({ title: "  " }), null)
})

test("pages are walked until the watchlist ends", async () => {
  const films = await collectWatchlist(async (page) => {
    if (page === 1) {
      return { total_pages: 2, results: [{ title: "Chronicle", poster_path: "/a.jpg" }] }
    }
    return { total_pages: 2, results: [{ title: "Haywire", poster_path: null }] }
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
      if (page === 1) return { total_pages: 2, results: [{ title: "Chronicle", poster_path: "/a.jpg" }] }
      await gate
      return { total_pages: 2, results: [{ title: "Haywire", poster_path: null }] }
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
