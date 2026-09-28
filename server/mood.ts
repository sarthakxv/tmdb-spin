import type { Strength } from "../shared/types.ts"

export const CHOICE_LIMIT = 255
const FILM_BATCH = CHOICE_LIMIT - 1
const NONE = "none"
const OVERVIEW_LIMIT = 240
const PARALLEL_GROUPS = 4

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

export type Answer = { choice: string; probability?: number }
export type Ask = (criteria: Record<string, string>) => Promise<Answer>
export type Pick = { index: number; probability?: number }

export function strengthOf(probability?: number): Strength | null {
  if (probability == null) return null
  if (probability >= 0.6) return "strong"
  if (probability >= 0.3) return "good"
  return "loose"
}

export async function selectByMood(films: MoodFilm[], ask: Ask): Promise<Pick | null> {
  if (films.length === 0) throw new MoodError("The watchlist is empty.", 400)
  return narrow(films, films.map((_, index) => index), ask)
}

async function narrow(films: MoodFilm[], indices: number[], ask: Ask): Promise<Pick | null> {
  if (indices.length === 0) return null
  if (indices.length <= FILM_BATCH) {
    const criteria: Record<string, string> = {
      [NONE]: "None of these films fit the mood",
    }
    for (const [local, filmIndex] of indices.entries()) {
      criteria[String(local)] = filmBlurb(films[filmIndex]!)
    }
    const answer = await ask(criteria)
    if (answer.choice === NONE) return null
    const local = Number(answer.choice)
    if (!Number.isInteger(local) || criteria[answer.choice] === undefined) {
      throw new MoodError("Jev could not pick a movie.")
    }
    return { index: indices[local]!, probability: answer.probability }
  }

  const groups: number[][] = []
  for (let start = 0; start < indices.length; start += FILM_BATCH) groups.push(indices.slice(start, start + FILM_BATCH))
  const winners = (await mapLimit(groups, PARALLEL_GROUPS, (group) => narrow(films, group, ask))).filter(
    (winner): winner is Pick => winner != null,
  )
  return narrow(
    films,
    winners.map((winner) => winner.index),
    ask,
  )
}

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await run(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
