export const RING_LIMIT = 48

export function sampleFilms<T>(films: T[], count = RING_LIMIT, random = Math.random): T[] {
  const copy = films.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const current = copy[i]
    copy[i] = copy[j]
    copy[j] = current
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function growRing<T>(ring: T[], batch: T[], random = Math.random, limit = Number.POSITIVE_INFINITY): T[] {
  if (batch.length === 0 || ring.length >= limit) return ring
  if (ring.length === 0) return sampleFilms(batch, Math.min(batch.length, limit), random)
  return ring.concat(batch.slice(0, limit - ring.length))
}

export function randomPick<T extends { id: number }>(films: T[], avoidId: number | null, random = Math.random): T | null {
  const pool = films.length > 1 ? films.filter((film) => film.id !== avoidId) : films
  if (pool.length === 0) return null
  return pool[Math.floor(random() * pool.length)]!
}

export function placePick<T extends { id: number }>(
  ring: T[],
  film: T,
  backIndex: number,
  limit = RING_LIMIT,
): { ring: T[]; index: number } {
  const found = ring.findIndex((item) => item.id === film.id)
  if (found !== -1) return { ring, index: found }
  if (ring.length < limit) return { ring: [...ring, film], index: ring.length }
  const index = ((backIndex % ring.length) + ring.length) % ring.length
  return { ring: ring.map((item, i) => (i === index ? film : item)), index }
}
