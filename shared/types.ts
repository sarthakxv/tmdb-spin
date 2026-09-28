export type Film = {
  id: number
  name: string
  poster: string | null
  overview: string
  year: number | null
  genreIds: number[]
  media: Media
}

export type Media = "movie" | "tv"

export type Strength = "strong" | "good" | "loose"

export type FilmDetails = {
  id: number
  year: number | null
  runtime: number | null
  rating: number | null
  genres: string[]
  overview: string
  trailer: string | null
  providers: { name: string; logo: string | null }[]
  watchLink: string | null
  link: string
}

export function tmdbLink(media: Media, id: number): string {
  return `https://www.themoviedb.org/${media}/${id}`
}
