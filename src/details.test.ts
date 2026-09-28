import assert from "node:assert/strict"
import test from "node:test"
import { formatRuntime, metaLine } from "./details.ts"

test("runtimes read as hours and minutes", () => {
  assert.equal(formatRuntime(45), "45m")
  assert.equal(formatRuntime(60), "1h")
  assert.equal(formatRuntime(134), "2h 14m")
})

test("the meta line skips missing facts", () => {
  const base = {
    id: 1,
    genres: [] as string[],
    overview: "",
    trailer: null,
    providers: [],
    watchLink: null,
    link: "",
  }
  assert.equal(metaLine({ ...base, year: 1995, runtime: 170, rating: 7.9 }), "1995 · 2h 50m · ★ 7.9")
  assert.equal(metaLine({ ...base, year: null, runtime: null, rating: 8 }), "★ 8.0")
})
