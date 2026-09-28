export const MOOD_SUGGESTIONS = ["Cozy", "Mind-bending", "Short and funny", "Edge of my seat", "A good cry", "Comfort rewatch"]

export function rememberMood(recent: string[], mood: string, max = 3): string[] {
  const trimmed = mood.trim()
  if (!trimmed) return recent
  const key = trimmed.toLowerCase()
  return [trimmed, ...recent.filter((item) => item.toLowerCase() !== key)].slice(0, max)
}

export function moodChips(recent: string[], suggestions: string[], max = 6): string[] {
  const seen = new Set<string>()
  const chips: string[] = []
  for (const mood of [...recent, ...suggestions]) {
    const key = mood.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chips.push(mood)
    if (chips.length === max) break
  }
  return chips
}
