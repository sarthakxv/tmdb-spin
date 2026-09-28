import assert from "node:assert/strict"
import test from "node:test"
import { ConfigError, readConfig } from "./config.ts"

const env = { TMDB_API_KEY: " tmdb ", OPENROUTER_API_KEY: "router" }

test("the keys become a config", () => {
  assert.deepEqual(readConfig(env), { tmdbApiKey: "tmdb", openRouterKey: "router", envSession: null })
  assert.equal(readConfig({ ...env, TMDB_SESSION_ID: "sid" }).envSession, "sid")
})

test("missing keys are named", () => {
  assert.throws(() => readConfig({ TMDB_API_KEY: "tmdb", OPENROUTER_API_KEY: " " }), {
    message: "Add OPENROUTER_API_KEY to .env and restart.",
  })
  assert.throws(() => readConfig({}), ConfigError)
})
