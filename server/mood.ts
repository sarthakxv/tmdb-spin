export const CHOICE_LIMIT = 255
const OVERVIEW_LIMIT = 240

export type MoodFilm = { name: string; overview?: string }

export class MoodError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export function filmBlurb(film: MoodFilm): string {
  const name = film.name.trim()
  const overview = film.overview?.replace(/\s+/g, " ").trim() ?? ""
  if (!overview) return name
  if (overview.length <= OVERVIEW_LIMIT) return `${name}. ${overview}`
  return `${name}. ${overview.slice(0, OVERVIEW_LIMIT).trimEnd()}`
}

export type Ask = (criteria: Record<string, string>) => Promise<string>

export async function selectByMood(films: MoodFilm[], ask: Ask): Promise<number> {
  if (films.length === 0) throw new MoodError("The watchlist is empty.", 400)
  return narrow(films, films.map((_, index) => index), ask)
}

async function narrow(films: MoodFilm[], indices: number[], ask: Ask): Promise<number> {
  if (indices.length === 1) return indices[0]!
  if (indices.length <= CHOICE_LIMIT) {
    const criteria: Record<string, string> = {}
    for (const [local, filmIndex] of indices.entries()) {
      criteria[String(local)] = filmBlurb(films[filmIndex]!)
    }
    const choice = await ask(criteria)
    const local = Number(choice)
    if (!Number.isInteger(local) || criteria[choice] === undefined) {
      throw new MoodError("Jev could not pick a movie.")
    }
    return indices[local]!
  }

  const winners: number[] = []
  for (let start = 0; start < indices.length; start += CHOICE_LIMIT) {
    winners.push(await narrow(films, indices.slice(start, start + CHOICE_LIMIT), ask))
  }
  return narrow(films, winners, ask)
}
