import type { Film } from "../shared/types.ts"
import type { Ask } from "./mood.ts"
import type { Tmdb } from "./watchlist.ts"

export const FAKE_FILMS: Film[] = [
  { id: 157336, name: "Interstellar", poster: null, overview: "Explorers travel through space to save humanity." },
  { id: 116149, name: "Paddington", poster: null, overview: "A cozy bear finds a home in London." },
  { id: 949, name: "Heat", poster: null, overview: "A heist crew and a detective collide." },
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
  }
}

export function fakeAsk(mood: string): Ask {
  return async (criteria) => {
    const word = mood.toLowerCase()
    const hit = Object.entries(criteria).find(([key, text]) => key !== "none" && text.toLowerCase().includes(word))
    return hit ? hit[0] : "none"
  }
}
