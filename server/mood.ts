export const CHOICE_LIMIT = 255
const FILM_BATCH = CHOICE_LIMIT - 1
const NONE = "none"
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

export async function selectByMood(films: MoodFilm[], ask: Ask): Promise<number | null> {
  if (films.length === 0) throw new MoodError("The watchlist is empty.", 400)
  return narrow(films, films.map((_, index) => index), ask)
}

async function narrow(films: MoodFilm[], indices: number[], ask: Ask): Promise<number | null> {
  if (indices.length === 0) return null
  if (indices.length <= FILM_BATCH) {
    const criteria: Record<string, string> = {
      [NONE]: "None of these films fit the mood",
    }
    for (const [local, filmIndex] of indices.entries()) {
      criteria[String(local)] = filmBlurb(films[filmIndex]!)
    }
    const choice = await ask(criteria)
    if (choice === NONE) return null
    const local = Number(choice)
    if (!Number.isInteger(local) || criteria[choice] === undefined) {
      throw new MoodError("Jev could not pick a movie.")
    }
    return indices[local]!
  }

  const winners: number[] = []
  for (let start = 0; start < indices.length; start += FILM_BATCH) {
    const winner = await narrow(films, indices.slice(start, start + FILM_BATCH), ask)
    if (winner != null) winners.push(winner)
  }
  return narrow(films, winners, ask)
}
