export type TtlCache<V> = {
  get(key: string): V | undefined
  set(key: string, value: V): void
  delete(key: string): void
}

export function createTtlCache<V>(options: { ttlMs: number; maxEntries: number; now?: () => number }): TtlCache<V> {
  const now = options.now ?? Date.now
  const entries = new Map<string, { value: V; at: number }>()
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (now() - entry.at >= options.ttlMs) {
        entries.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key, value) {
      entries.delete(key)
      entries.set(key, { value, at: now() })
      while (entries.size > options.maxEntries) entries.delete(entries.keys().next().value as string)
    },
    delete(key) {
      entries.delete(key)
    },
  }
}
