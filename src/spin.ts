export function targetRotation(current: number, index: number, count: number, turns = 3): number {
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

export const CENTER_SCALE = 1.5

export function degreesFromFront(rotationAngle: number): number {
  const wrapped = ((rotationAngle % 360) + 360) % 360
  return wrapped > 180 ? 360 - wrapped : wrapped
}

export function coverScale(rotationAngle: number, count: number): number {
  if (count <= 1) return CENTER_SCALE
  const fromFront = degreesFromFront(rotationAngle)
  const distance = fromFront / (360 / count)
  if (distance < 1) {
    const eased = distance * distance * (3 - 2 * distance)
    return CENTER_SCALE - eased * (CENTER_SCALE - 1)
  }
  return Math.max(0.72, 1 - (distance - 1) * 0.1)
}
