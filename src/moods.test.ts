import assert from "node:assert/strict"
import test from "node:test"
import { moodChips, rememberMood } from "./moods.ts"

test("recent moods are newest first, without repeats", () => {
  assert.deepEqual(rememberMood(["cozy", "tense"], "Tense"), ["Tense", "cozy"])
  assert.deepEqual(rememberMood(["a", "b", "c"], "d"), ["d", "a", "b"])
  assert.deepEqual(rememberMood(["a"], "  "), ["a"])
})

test("chips put recent moods before suggestions and skip duplicates", () => {
  assert.deepEqual(moodChips(["cozy"], ["Cozy", "Tense", "Funny"], 3), ["cozy", "Tense", "Funny"])
})
