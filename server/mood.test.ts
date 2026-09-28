import assert from "node:assert/strict"
import test from "node:test"
import { CHOICE_LIMIT, filmBlurb, selectByMood, strengthOf } from "./mood.ts"

test("a blurb is the title plus a short synopsis", () => {
  assert.equal(filmBlurb({ name: "Heat" }), "Heat")
  assert.equal(filmBlurb({ name: "Past Lives", overview: "  Two   people meet. " }), "Past Lives. Two people meet.")
  const long = "word ".repeat(80)
  const blurb = filmBlurb({ name: "Heat", overview: long })
  assert.ok(blurb.startsWith("Heat. "))
  assert.ok(blurb.length <= "Heat. ".length + 240)
})

test("jev's choice is the film index", async () => {
  const index = await selectByMood(
    [{ name: "Heat" }, { name: "Past Lives", overview: "two people reunite" }],
    async (criteria) => ({
      choice: Object.entries(criteria).find(([, text]) => text.startsWith("Past Lives"))?.[0] ?? "0",
    }),
  )
  assert.equal(index?.index, 1)
})

test("one film can still be refused", async () => {
  let called = false
  const index = await selectByMood([{ name: "Only" }], async (criteria) => {
    called = true
    assert.equal(typeof criteria.none, "string")
    return { choice: "none" }
  })
  assert.equal(called, true)
  assert.equal(index, null)
})

test("jev can say nothing fits", async () => {
  const index = await selectByMood([{ name: "Heat" }, { name: "Past Lives" }], async () => ({ choice: "none" }))
  assert.equal(index, null)
})

test("more than 255 films are narrowed in rounds", async () => {
  const films = Array.from({ length: CHOICE_LIMIT + 45 }, (_, index) => ({ name: `Film ${index}` }))
  const sizes: number[] = []
  const index = await selectByMood(films, async (criteria) => {
    sizes.push(Object.keys(criteria).length)
    let bestKey = "0"
    let best = -1
    for (const [key, text] of Object.entries(criteria)) {
      const number = Number(text.slice("Film ".length))
      if (number > best) {
        best = number
        bestKey = key
      }
    }
    return { choice: bestKey }
  })
  assert.equal(index?.index, films.length - 1)
  assert.deepEqual(sizes, [CHOICE_LIMIT, 47, 3])
})

test("every group refusing means nothing fits", async () => {
  const films = Array.from({ length: CHOICE_LIMIT }, () => ({ name: "Film" }))
  let calls = 0
  const index = await selectByMood(films, async () => {
    calls += 1
    return { choice: "none" }
  })
  assert.equal(index, null)
  assert.equal(calls, 2)
})

test("first-round groups are asked at the same time", async () => {
  const films = Array.from({ length: CHOICE_LIMIT * 3 }, (_, i) => ({ name: `Film ${i}` }))
  let inFlight = 0
  let most = 0
  const index = await selectByMood(films, async () => {
    inFlight += 1
    most = Math.max(most, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 5))
    inFlight -= 1
    return { choice: "0" }
  })
  assert.ok(most > 1)
  assert.equal(index?.index, 0)
})

test("the winning probability comes back with the pick", async () => {
  const pick = await selectByMood([{ name: "Heat" }, { name: "Brick" }], async () => ({ choice: "1", probability: 0.72 }))
  assert.deepEqual(pick, { index: 1, probability: 0.72 })
})

test("probabilities become a strength", () => {
  assert.equal(strengthOf(0.6), "strong")
  assert.equal(strengthOf(0.3), "good")
  assert.equal(strengthOf(0.1), "loose")
  assert.equal(strengthOf(undefined), null)
})

test("an unknown choice is rejected", async () => {
  await assert.rejects(() => selectByMood([{ name: "A" }, { name: "B" }], async () => ({ choice: "nope" })), /could not pick/)
})
