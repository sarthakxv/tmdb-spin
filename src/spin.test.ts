import assert from "node:assert/strict"
import test from "node:test"
import { sampleFilms } from "./sample.ts"
import { frontIndex, targetRotation } from "./spin.ts"

test("a spin lands on the chosen card", () => {
  for (const count of [1, 7, 24]) {
    for (let index = 0; index < count; index++) {
      const target = targetRotation(20, index, count)
      assert.equal(frontIndex(target, count), index)
      assert.ok(target <= 20 - 360 * 3)
    }
  }
})

test("the ring sample stays inside the watchlist", () => {
  const films = ["a", "b", "c"]
  const sample = sampleFilms(films, 24, () => 0)
  assert.equal(sample.length, 3)
  assert.deepEqual(sample.sort(), ["a", "b", "c"])
})
