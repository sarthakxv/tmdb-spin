import assert from "node:assert/strict"
import test from "node:test"
import { CHOICE_LIMIT, filmBlurb, selectByMood } from "./mood.ts"

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
    async (criteria) => Object.entries(criteria).find(([, text]) => text.startsWith("Past Lives"))?.[0] ?? "0",
  )
  assert.equal(index, 1)
})

test("one film is chosen without asking", async () => {
  let called = false
  const index = await selectByMood([{ name: "Only" }], async () => {
    called = true
    return "0"
  })
  assert.equal(index, 0)
  assert.equal(called, false)
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
    return bestKey
  })
  assert.equal(index, films.length - 1)
  assert.deepEqual(sizes, [CHOICE_LIMIT, 45, 2])
})

test("an unknown choice is rejected", async () => {
  await assert.rejects(() => selectByMood([{ name: "A" }, { name: "B" }], async () => "nope"), /could not pick/)
})
