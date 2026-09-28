import assert from "node:assert/strict"
import test from "node:test"
import { createTtlCache } from "./ttl-cache.ts"

test("a value lives until its time runs out", () => {
  let now = 0
  const cache = createTtlCache<string>({ ttlMs: 100, maxEntries: 10, now: () => now })
  cache.set("a", "x")
  now = 99
  assert.equal(cache.get("a"), "x")
  now = 100
  assert.equal(cache.get("a"), undefined)
})

test("the oldest value is dropped when the cache is full", () => {
  const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2 })
  cache.set("a", 1)
  cache.set("b", 2)
  cache.set("c", 3)
  assert.equal(cache.get("a"), undefined)
  assert.equal(cache.get("c"), 3)
})
