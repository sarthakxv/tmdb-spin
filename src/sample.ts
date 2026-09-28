export const RING_SIZE = 24

export function sampleFilms<T>(films: T[], count = RING_SIZE, random = Math.random): T[] {
  const copy = films.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const current = copy[i]
    copy[i] = copy[j]
    copy[j] = current
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function growRing<T>(ring: T[], batch: T[], random = Math.random): T[] {
  if (batch.length === 0) return ring
  if (ring.length === 0) return sampleFilms(batch, batch.length, random)
  return ring.concat(batch)
}
