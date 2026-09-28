import assert from "node:assert/strict"
import test from "node:test"
import { shareText } from "./share.ts"

test("the share text names the film and the mood", () => {
  assert.equal(shareText({ name: "Heat", year: 1995 }, "tense"), "Tonight's pick for “tense”: Heat (1995)")
  assert.equal(shareText({ name: "Heat", year: null }, ""), "Tonight's pick: Heat")
})
