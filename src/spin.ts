export function targetRotation(current: number, index: number, count: number, turns = 4): number {
  const step = 360 / count
  const cardBase = index * step
  const min = current - 360 * turns
  const k = Math.floor((min + cardBase) / 360)
  return -cardBase + 360 * k
}

export function frontIndex(rotation: number, count: number): number {
  const step = 360 / count
  const normalized = ((-rotation % 360) + 360) % 360
  const index = Math.round(normalized / step)
  return index % count
}
