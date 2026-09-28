import assert from "node:assert/strict"
import test from "node:test"
import { decadesOf, matchesFilter, NO_FILTER } from "./filter.ts"

const heat = { id: 1, name: "Heat", poster: null, overview: "", year: 1995, genreIds: [80, 18], media: "movie" as const }
const brick = { id: 2, name: "Brick", poster: null, overview: "", year: 2005, genreIds: [9648], media: "movie" as const }

test("no filter keeps every film", () => {
  assert.equal(matchesFilter(heat, NO_FILTER), true)
})

test("any chosen genre matches", () => {
  assert.equal(matchesFilter(heat, { genreIds: [18, 35], decades: [] }), true)
  assert.equal(matchesFilter(brick, { genreIds: [18], decades: [] }), false)
})

test("decades and genres must both match", () => {
  assert.equal(matchesFilter(heat, { genreIds: [80], decades: [1990] }), true)
  assert.equal(matchesFilter(heat, { genreIds: [80], decades: [2000] }), false)
})

test("a film without a year is kept only when no decade is chosen", () => {
  const undated = { ...brick, year: null }
  assert.equal(matchesFilter(undated, NO_FILTER), true)
  assert.equal(matchesFilter(undated, { genreIds: [], decades: [2000] }), false)
})

test("decades are listed newest first", () => {
  assert.deepEqual(decadesOf([heat, brick, { ...heat, id: 3 }]), [2000, 1990])
})
