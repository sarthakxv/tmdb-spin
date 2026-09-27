import type { Film } from "./types"

export class WatchlistError extends Error {}

export async function readWatchlist(response: Response, onFilms: (films: Film[]) => void): Promise<void> {
  if (!response.body) throw new WatchlistError("Could not load the watchlist.")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const consume = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const chunk = JSON.parse(trimmed) as { films?: Film[]; error?: string }
    if (chunk.error) throw new WatchlistError(chunk.error)
    if (chunk.films?.length) onFilms(chunk.films)
  }

  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) consume(line)
    if (done) break
  }

  if (buffer.trim()) consume(buffer)
}
