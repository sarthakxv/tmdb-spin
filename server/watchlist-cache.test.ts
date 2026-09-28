import assert from "node:assert/strict"
import test from "node:test"
import { createWatchlistCache } from "./watchlist-cache.ts"

const heat = { id: 1, name: "Heat", poster: null, overview: "", year: 1995, genreIds: [80], media: "movie" as const }

test("a cached watchlist is not fetched again", async () => {
  const cache = createWatchlistCache()
  let fetches = 0
  const fetchAll = async (onPage: (films: (typeof heat)[]) => void) => {
    fetches += 1
    onPage([heat])
    return [heat]
  }
  await cache.load("a", fetchAll)
  const pages: number[] = []
  const films = await cache.load("a", fetchAll, (page) => pages.push(page.length))
  assert.equal(fetches, 1)
  assert.deepEqual(films, [heat])
  assert.deepEqual(pages, [1])
})

test("two loads at once share one fetch", async () => {
  const cache = createWatchlistCache()
  let fetches = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const fetchAll = async () => {
    fetches += 1
    await gate
    return [heat]
  }
  const first = cache.load("a", fetchAll)
  const second = cache.load("a", fetchAll)
  release()
  assert.deepEqual(await Promise.all([first, second]), [[heat], [heat]])
  assert.equal(fetches, 1)
})

test("a failed fetch is not cached", async () => {
  const cache = createWatchlistCache()
  await assert.rejects(
    cache.load("a", async () => {
      throw new Error("down")
    }),
  )
  assert.equal(cache.peek("a"), null)
})

test("dropping forgets the watchlist", async () => {
  const cache = createWatchlistCache()
  cache.set("a", [heat])
  cache.drop("a")
  assert.equal(cache.peek("a"), null)
})
