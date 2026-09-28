import assert from "node:assert/strict"
import test from "node:test"
import { growRing, sampleFilms } from "./sample.ts"
import { coverScale, frontIndex, targetRotation } from "./spin.ts"

test("a spin lands on the chosen card", () => {
  for (const count of [1, 7, 24]) {
    for (let index = 0; index < count; index++) {
      const target = targetRotation(20, index, count)
      assert.equal(frontIndex(target, count), index)
      assert.ok(target <= 20 - 360 * 3)
    }
  }
})

test("only the cover at the front is large", () => {
  const many = 400
  const step = 360 / many
  assert.equal(coverScale(0, many), 1.7)
  assert.equal(coverScale(step, many), 1)
  assert.equal(coverScale(-step, many), 1)
  assert.ok(coverScale(step / 2, many) > 1)
  assert.ok(coverScale(step / 2, many) < 1.7)
  assert.equal(coverScale(360 / 20, 20), 1)
})

test("the ring sample stays inside the watchlist", () => {
  const films = ["a", "b", "c"]
  const sample = sampleFilms(films, 24, () => 0)
  assert.equal(sample.length, 3)
  assert.deepEqual(sample.sort(), ["a", "b", "c"])
})

test("later watchlist pages join the ring without moving films already on it", () => {
  const page1 = ["Chronicle", "Haywire", "Brick"]
  const page2 = ["Primer", "Coherence"]
  const opened = growRing([], page1, () => 0)
  const grown = growRing(opened, page2, () => 0)
  assert.deepEqual(grown.slice(0, opened.length), opened)
  assert.deepEqual(grown.slice(opened.length), page2)
  assert.equal(grown.length, page1.length + page2.length)
})
