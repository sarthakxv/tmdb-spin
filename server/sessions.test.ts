import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileStore, memoryStore, type SessionStore } from "./sessions.ts"

function tempFile() {
  return join(mkdtempSync(join(tmpdir(), "watchlist-spin-")), ".tmdb-session")
}

const stores: [string, () => SessionStore][] = [
  ["memory", () => memoryStore()],
  ["file", () => fileStore(tempFile())],
]

for (const [name, make] of stores) {
  test(`${name}: a saved session comes back`, () => {
    const store = make()
    assert.equal(store.get("local"), null)
    store.save({ id: "local", tmdbSessionId: "sid", requestToken: null })
    assert.deepEqual(store.get("local"), { id: "local", tmdbSessionId: "sid", requestToken: null })
  })

  test(`${name}: a pending request token is kept until approval`, () => {
    const store = make()
    store.save({ id: "local", tmdbSessionId: null, requestToken: "tok" })
    assert.deepEqual(store.get("local"), { id: "local", tmdbSessionId: null, requestToken: "tok" })
  })

  test(`${name}: a deleted session is gone`, () => {
    const store = make()
    store.save({ id: "local", tmdbSessionId: "sid", requestToken: null })
    store.delete("local")
    assert.equal(store.get("local"), null)
  })
}

test("file: a session saved by the old app is still read", () => {
  const file = tempFile()
  writeFileSync(file, "old-sid\n")
  assert.equal(fileStore(file).get("local")?.tmdbSessionId, "old-sid")
})
