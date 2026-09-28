import type { Film } from "./types.ts"

export type FilmFilter = { genreIds: number[]; decades: number[] }

export const NO_FILTER: FilmFilter = { genreIds: [], decades: [] }

export function matchesFilter(film: Film, filter: FilmFilter): boolean {
  if (filter.genreIds.length > 0 && !film.genreIds.some((id) => filter.genreIds.includes(id))) return false
  if (filter.decades.length > 0) {
    if (film.year == null) return false
    if (!filter.decades.includes(Math.floor(film.year / 10) * 10)) return false
  }
  return true
}

export function decadesOf(films: Film[]): number[] {
  const decades = new Set<number>()
  for (const film of films) if (film.year != null) decades.add(Math.floor(film.year / 10) * 10)
  return [...decades].sort((a, b) => b - a)
}
