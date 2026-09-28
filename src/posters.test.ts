import assert from "node:assert/strict"
import test from "node:test"
import { posterLarge, posterSrcSet } from "./posters.ts"

test("ring posters offer two small sizes", () => {
  assert.equal(
    posterSrcSet("/a.jpg"),
    "https://image.tmdb.org/t/p/w185/a.jpg 185w, https://image.tmdb.org/t/p/w342/a.jpg 342w",
  )
})

test("the revealed poster is large", () => {
  assert.equal(posterLarge("/a.jpg"), "https://image.tmdb.org/t/p/w780/a.jpg")
})
