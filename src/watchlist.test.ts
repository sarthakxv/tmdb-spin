import assert from "node:assert/strict"
import test from "node:test"
import type { Film } from "./types.ts"
import { readWatchlist, WatchlistError } from "./watchlist.ts"

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
  )
}

const chronicle: Film = { id: 1, name: "Chronicle", poster: null, overview: "", year: 2012, genreIds: [] }
const haywire: Film = { id: 2, name: "Haywire", poster: null, overview: "", year: null, genreIds: [] }

test("films arrive page by page, including a line split across chunks", async () => {
  const seen: Film[][] = []
  const line = JSON.stringify({ films: [haywire] })
  await readWatchlist(
    streamResponse([`${JSON.stringify({ films: [chronicle] })}\n${line.slice(0, 8)}`, `${line.slice(8)}\n`]),
    (films) => seen.push(films),
  )
  assert.deepEqual(seen, [[chronicle], [haywire]])
})

test("a stream error keeps the pages already delivered", async () => {
  const seen: Film[][] = []
  await assert.rejects(
    readWatchlist(
      streamResponse([
        `${JSON.stringify({ films: [chronicle] })}\n`,
        `${JSON.stringify({ error: "TMDB could not complete that request." })}\n`,
      ]),
      (films) => seen.push(films),
    ),
    (error: unknown) => error instanceof WatchlistError && error.message.includes("TMDB"),
  )
  assert.deepEqual(seen, [[chronicle]])
})
