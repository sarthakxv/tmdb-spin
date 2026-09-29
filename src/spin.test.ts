import assert from "node:assert/strict"
import test from "node:test"
import { growRing, placePick, randomPick, sampleFilms } from "./sample.ts"
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

test("covers get smaller farther from the front", () => {
  const many = 400
  const step = 360 / many
  assert.equal(coverScale(0, many), 1.5)
  assert.equal(coverScale(step, many), 1)
  assert.equal(coverScale(-step, many), 1)
  assert.ok(coverScale(step / 2, many) > 1)
  assert.ok(coverScale(step / 2, many) < 1.5)
  assert.equal(coverScale(360 / 20, 20), 1)
  assert.ok(coverScale(step * 2, many) < coverScale(step, many))
  assert.ok(coverScale(step * 3, many) < coverScale(step * 2, many))
  assert.equal(coverScale(step * 6, many), 0.72)
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

test("the ring stops growing at its limit", () => {
  const ring = growRing(growRing([], ["a", "b"], () => 0, 3), ["c", "d"], () => 0, 3)
  assert.equal(ring.length, 3)
})

test("a pick already on the ring stays where it is", () => {
  const films = [
    { id: 1, name: "Heat" },
    { id: 2, name: "Brick" },
  ]
  assert.deepEqual(placePick(films, films[1]!, 0), { ring: films, index: 1 })
})

test("a pick outside a full ring replaces the card at the back", () => {
  const ring = Array.from({ length: 3 }, (_, id) => ({ id, name: `Film ${id}` }))
  const outside = { id: 99, name: "Outside" }
  const placed = placePick(ring, outside, 1, 3)
  assert.equal(placed.ring.length, 3)
  assert.equal(placed.index, 1)
  assert.equal(placed.ring[1]!.id, 99)
})

test("a random pick avoids the last film when it can", () => {
  const films = [{ id: 1 }, { id: 2 }]
  assert.equal(randomPick(films, 1, () => 0)?.id, 2)
  assert.equal(randomPick([{ id: 1 }], 1, () => 0)?.id, 1)
  assert.equal(randomPick([], null), null)
})

test("a pick outside a short ring is added", () => {
  const ring = [{ id: 1, name: "Heat" }]
  const placed = placePick(ring, { id: 2, name: "Brick" }, 0, 48)
  assert.equal(placed.index, 1)
  assert.equal(placed.ring.length, 2)
})
