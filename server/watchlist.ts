export type Film = { name: string; poster: string | null }

export type WatchlistMovie = {
  title?: string
  poster_path?: string | null
}

export type WatchlistPage = {
  total_pages?: number
  results?: WatchlistMovie[]
}

const POSTER_BASE = "https://image.tmdb.org/t/p/w500"

export class TmdbError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function applyAuth(url: URL, headers: Record<string, string>, apiKey: string) {
  headers.accept = "application/json"
  if (apiKey.startsWith("eyJ")) headers.authorization = `Bearer ${apiKey}`
  else url.searchParams.set("api_key", apiKey)
}

export function toFilm(movie: WatchlistMovie): Film | null {
  const name = movie.title?.trim()
  if (!name) return null
  return {
    name,
    poster: movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null,
  }
}

export async function collectWatchlist(
  fetchPage: (page: number) => Promise<WatchlistPage>,
  onPage?: (films: Film[]) => void,
): Promise<Film[]> {
  const films: Film[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= 100) {
    const data = await fetchPage(page)
    totalPages = data.total_pages ?? 1
    const pageFilms: Film[] = []
    for (const movie of data.results ?? []) {
      const film = toFilm(movie)
      if (!film) continue
      films.push(film)
      pageFilms.push(film)
    }
    if (pageFilms.length > 0) onPage?.(pageFilms)
    page++
  }
  return films
}

async function tmdb<T>(apiKey: string, path: string, sessionId?: string, init?: { method?: string; body?: unknown; page?: number }): Promise<T> {
  const url = new URL(`https://api.themoviedb.org${path}`)
  if (sessionId) url.searchParams.set("session_id", sessionId)
  if (init?.page) url.searchParams.set("page", String(init.page))
  const headers: Record<string, string> = {}
  applyAuth(url, headers, apiKey)
  if (init?.body) headers["content-type"] = "application/json"
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 401) throw new TmdbError("TMDB rejected the credentials.", 401)
  if (!response.ok) throw new TmdbError("TMDB could not complete that request.", response.status)
  return (await response.json()) as T
}

export async function createRequestToken(apiKey: string): Promise<string> {
  const data = await tmdb<{ success?: boolean; request_token?: string }>(apiKey, "/3/authentication/token/new")
  if (!data.success || !data.request_token) throw new TmdbError("TMDB did not return a request token.", 502)
  return data.request_token
}

export async function createSession(apiKey: string, requestToken: string): Promise<string> {
  const data = await tmdb<{ success?: boolean; session_id?: string }>(apiKey, "/3/authentication/session/new", undefined, {
    method: "POST",
    body: { request_token: requestToken },
  })
  if (!data.success || !data.session_id) throw new TmdbError("TMDB didn't approve the connection.", 401)
  return data.session_id
}

export async function fetchWatchlist(
  apiKey: string,
  sessionId: string,
  onPage?: (films: Film[]) => void,
): Promise<Film[]> {
  const account = await tmdb<{ id?: number }>(apiKey, "/3/account", sessionId)
  if (!account.id) throw new TmdbError("TMDB did not return an account.", 502)
  return collectWatchlist(
    (page) => tmdb<WatchlistPage>(apiKey, `/3/account/${account.id}/watchlist/movies`, sessionId, { page }),
    onPage,
  )
}
