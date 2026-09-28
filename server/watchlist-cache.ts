import type { Film } from "../shared/types.ts"
import { createTtlCache } from "./ttl-cache.ts"

export type WatchlistCache = {
  load(
    key: string,
    fetchAll: (onPage: (films: Film[]) => void) => Promise<Film[]>,
    onPage?: (films: Film[]) => void,
  ): Promise<Film[]>
  peek(key: string): Film[] | null
  set(key: string, films: Film[]): void
  drop(key: string): void
}

export function createWatchlistCache(
  options: { ttlMs?: number; maxEntries?: number; now?: () => number } = {},
): WatchlistCache {
  const cache = createTtlCache<Film[]>({
    ttlMs: options.ttlMs ?? 10 * 60 * 1000,
    maxEntries: options.maxEntries ?? 500,
    now: options.now,
  })
  const loading = new Map<string, Promise<Film[]>>()

  return {
    async load(key, fetchAll, onPage) {
      const cached = cache.get(key)
      if (cached) {
        if (cached.length > 0) onPage?.(cached)
        return cached
      }
      const running = loading.get(key)
      if (running) {
        const films = await running
        if (films.length > 0) onPage?.(films)
        return films
      }
      const promise = fetchAll((films) => onPage?.(films))
      loading.set(key, promise)
      try {
        const films = await promise
        cache.set(key, films)
        return films
      } finally {
        loading.delete(key)
      }
    },
    peek: (key) => cache.get(key) ?? null,
    set: (key, films) => cache.set(key, films),
    drop: (key) => cache.delete(key),
  }
}
