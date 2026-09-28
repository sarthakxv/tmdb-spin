import type { Film } from "./types"

export function shareText(film: Pick<Film, "name" | "year">, mood: string): string {
  const title = film.year ? `${film.name} (${film.year})` : film.name
  const feeling = mood.trim()
  return feeling ? `Tonight's pick for “${feeling}”: ${title}` : `Tonight's pick: ${title}`
}
