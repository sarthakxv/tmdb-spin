import type { FilmDetails } from "./types"

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function metaLine(details: FilmDetails): string {
  const parts: string[] = []
  if (details.year) parts.push(String(details.year))
  if (details.runtime) parts.push(formatRuntime(details.runtime))
  if (details.rating != null) parts.push(`★ ${details.rating.toFixed(1)}`)
  return parts.join(" · ")
}

export function visitorRegion(): string {
  try {
    return new Intl.Locale(navigator.language).maximize().region ?? "US"
  } catch {
    return "US"
  }
}
