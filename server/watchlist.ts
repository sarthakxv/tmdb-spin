import { type Film, type FilmDetails, type Media, tmdbLink } from "../shared/types.ts"

export type { Film }

export type WatchlistMovie = {
  id?: number
  title?: string
  poster_path?: string | null
  overview?: string | null
  release_date?: string
  genre_ids?: number[]
}

export type WatchlistPage = {
  total_pages?: number
  results?: WatchlistMovie[]
}

const API_BASE = "https://api.themoviedb.org"
const TIMEOUT_MS = 8000
const MAX_RETRY_WAIT_MS = 10_000

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
  if (!name || typeof movie.id !== "number") return null
  return {
    id: movie.id,
    name,
    poster: movie.poster_path || null,
    overview: movie.overview?.trim() ?? "",
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
    genreIds: movie.genre_ids ?? [],
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

export function retryDelay(response: Response | null, attempt: number): number {
  const header = response?.headers.get("retry-after")
  const seconds = header ? Number(header) : Number.NaN
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS)
  return 500 * 2 ** attempt
}

type Call = { sessionId?: string; method?: string; body?: unknown; page?: number }

type RawVideo = { site?: string; type?: string; key?: string; official?: boolean }
type RawProviders = { link?: string; flatrate?: { provider_name: string; logo_path?: string | null }[] }

export type RawDetails = {
  id: number
  release_date?: string
  runtime?: number | null
  vote_average?: number
  vote_count?: number
  genres?: { name: string }[]
  overview?: string | null
  videos?: { results?: RawVideo[] }
  "watch/providers"?: { results?: Record<string, RawProviders> }
}

export function toDetails(raw: RawDetails, media: Media, region: string): FilmDetails {
  const year = raw.release_date ? Number(raw.release_date.slice(0, 4)) || null : null
  const trailers = (raw.videos?.results ?? []).filter(
    (video) => video.site === "YouTube" && video.type === "Trailer" && video.key,
  )
  const trailer = trailers.find((video) => video.official) ?? trailers[0]
  const local = raw["watch/providers"]?.results?.[region]
  const rated = (raw.vote_count ?? 0) >= 20 && typeof raw.vote_average === "number"
  return {
    id: raw.id,
    year,
    runtime: raw.runtime || null,
    rating: rated ? Math.round(raw.vote_average! * 10) / 10 : null,
    genres: (raw.genres ?? []).map((genre) => genre.name).slice(0, 3),
    overview: raw.overview?.trim() ?? "",
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    providers: (local?.flatrate ?? []).slice(0, 4).map((provider) => ({
      name: provider.provider_name,
      logo: provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : null,
    })),
    watchLink: local?.link ?? null,
    link: tmdbLink(media, raw.id),
  }
}

export type Tmdb = {
  authorizeUrl(requestToken: string, redirectTo: string): string
  createRequestToken(): Promise<string>
  createSession(requestToken: string): Promise<string>
  deleteSession(sessionId: string): Promise<void>
  fetchWatchlist(sessionId: string, onPage?: (films: Film[]) => void): Promise<Film[]>
  titleDetails(media: Media, id: number, region: string): Promise<FilmDetails>
  setWatchlist(sessionId: string, media: Media, id: number, onList: boolean): Promise<void>
  genres(media: Media): Promise<{ id: number; name: string }[]>
}

export type TmdbOptions = {
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  retries?: number
}

export function createTmdb(apiKey: string, options: TmdbOptions = {}): Tmdb {
  const send = options.fetch ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const retries = options.retries ?? 3

  async function call<T>(path: string, request: Call = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    if (request.sessionId) url.searchParams.set("session_id", request.sessionId)
    if (request.page) url.searchParams.set("page", String(request.page))
    const headers: Record<string, string> = {}
    applyAuth(url, headers, apiKey)
    if (request.body) headers["content-type"] = "application/json"

    for (let attempt = 0; ; attempt++) {
      let response: Response | null = null
      try {
        response = await send(url, {
          method: request.method ?? "GET",
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        if (attempt >= retries) throw new TmdbError("TMDB did not respond.", 504)
      }
      if (response && response.status !== 429 && response.status < 500) {
        if (response.status === 401) throw new TmdbError("TMDB rejected the credentials.", 401)
        if (!response.ok) throw new TmdbError("TMDB could not complete that request.", response.status)
        return (await response.json()) as T
      }
      if (attempt >= retries) throw new TmdbError("TMDB could not complete that request.", response?.status ?? 504)
      await sleep(retryDelay(response, attempt))
    }
  }

  return {
    authorizeUrl(requestToken, redirectTo) {
      return `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`
    },
    async createRequestToken() {
      const data = await call<{ success?: boolean; request_token?: string }>("/3/authentication/token/new")
      if (!data.success || !data.request_token) throw new TmdbError("TMDB did not return a request token.", 502)
      return data.request_token
    },
    async createSession(requestToken) {
      const data = await call<{ success?: boolean; session_id?: string }>("/3/authentication/session/new", {
        method: "POST",
        body: { request_token: requestToken },
      })
      if (!data.success || !data.session_id) throw new TmdbError("TMDB didn't approve the connection.", 401)
      return data.session_id
    },
    async deleteSession(sessionId) {
      await call("/3/authentication/session", { method: "DELETE", body: { session_id: sessionId } })
    },
    async titleDetails(media, id, region) {
      const path = `/3/${media}/${id}?append_to_response=${encodeURIComponent("videos,watch/providers")}`
      return toDetails(await call<RawDetails>(path), media, region)
    },
    async genres(media) {
      const data = await call<{ genres?: { id: number; name: string }[] }>(`/3/genre/${media}/list`)
      return data.genres ?? []
    },
    async setWatchlist(sessionId, media, id, onList) {
      const account = await call<{ id?: number }>("/3/account", { sessionId })
      if (!account.id) throw new TmdbError("TMDB did not return an account.", 502)
      await call(`/3/account/${account.id}/watchlist`, {
        sessionId,
        method: "POST",
        body: { media_type: media, media_id: id, watchlist: onList },
      })
    },
    async fetchWatchlist(sessionId, onPage) {
      const account = await call<{ id?: number }>("/3/account", { sessionId })
      if (!account.id) throw new TmdbError("TMDB did not return an account.", 502)
      return collectWatchlist(
        (page) => call<WatchlistPage>(`/3/account/${account.id}/watchlist/movies`, { sessionId, page }),
        onPage,
      )
    },
  }
}
