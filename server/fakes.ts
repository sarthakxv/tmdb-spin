import { type Film, type FilmDetails, tmdbLink } from "../shared/types.ts"
import type { Ask } from "./mood.ts"
import type { Tmdb } from "./watchlist.ts"

export const FAKE_DETAILS: FilmDetails = {
  id: 0,
  year: 2014,
  runtime: 169,
  rating: 8.4,
  genres: ["Adventure", "Drama"],
  overview: "",
  trailer: null,
  providers: [],
  watchLink: null,
  link: "",
}

export const FAKE_FILMS: Film[] = [
  { id: 157336, name: "Interstellar", poster: "/interstellar.jpg", overview: "Explorers travel through space to save humanity.", year: 2014, genreIds: [12, 18, 878] },
  { id: 116149, name: "Paddington", poster: null, overview: "A cozy bear finds a home in London.", year: 2014, genreIds: [35, 10751] },
  { id: 949, name: "Heat", poster: null, overview: "A heist crew and a detective collide.", year: 1995, genreIds: [80, 18] },
  { id: 286217, name: "The Martian", poster: null, overview: "An astronaut is stranded in space.", year: 2015, genreIds: [18, 878] },
]

export function fakeTmdb(appUrl: string): Tmdb {
  return {
    authorizeUrl: (token) => `${appUrl}/api/auth/callback?request_token=${token}&approved=true`,
    createRequestToken: async () => "fake-token",
    createSession: async () => "fake-session",
    deleteSession: async () => {},
    fetchWatchlist: async (_sessionId, onPage) => {
      onPage?.(FAKE_FILMS)
      return FAKE_FILMS
    },
    titleDetails: async (media, id) => ({ ...FAKE_DETAILS, id, link: tmdbLink(media, id) }),
    setWatchlist: async () => {},
    genres: async () => [
      { id: 80, name: "Crime" },
      { id: 18, name: "Drama" },
      { id: 878, name: "Science Fiction" },
      { id: 35, name: "Comedy" },
    ],
  }
}

export function fakeAsk(mood: string): Ask {
  return async (criteria) => {
    const word = mood.toLowerCase()
    const hit = Object.entries(criteria).find(([key, text]) => key !== "none" && text.toLowerCase().includes(word))
    return { choice: hit ? hit[0] : "none" }
  }
}
