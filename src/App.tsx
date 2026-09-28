import { motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { Carousel } from "./Carousel"
import { cn } from "./lib/cn"
import { latchReel, missReel, primeReel } from "./reel-audio"
import { growRing } from "./sample"
import type { Film } from "./types"
import { readWatchlist, WatchlistError } from "./watchlist"

type Setup = "loading" | "connect" | "ready"

function WatchlistLoader() {
  const reduced = useReducedMotion()

  return (
    <div className="w-40" role="status" aria-label="Loading watchlist">
      <div className="h-px w-full overflow-hidden bg-neutral-800">
        <motion.div
          className="h-full origin-left bg-neutral-100"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={
            reduced ? { duration: 0 } : { duration: 1.1, ease: "easeInOut", repeat: Infinity }
          }
        />
      </div>
    </div>
  )
}

export function App() {
  const reducedMotion = useReducedMotion()
  const [setup, setSetup] = useState<Setup>("loading")
  const [ring, setRing] = useState<Film[]>([])
  const [phase, setPhase] = useState<"ready" | "closing" | "spinning" | "revealed">("ready")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [spinId, setSpinId] = useState(0)
  const pendingSpin = useRef<{ ring: Film[]; index: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [mood, setMood] = useState("")
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const denied = new URLSearchParams(window.location.search).get("auth") === "denied"
    if (denied) {
      setError("TMDB didn't approve the connection.")
      window.history.replaceState(null, "", "/")
    }

    const controller = new AbortController()
    let cancelled = false
    let opened = false
    ;(async () => {
      try {
        const health = (await fetch("/api/health", { signal: controller.signal }).then((response) =>
          response.json(),
        )) as { connected: boolean }
        if (cancelled) return
        if (!health.connected) {
          setSetup("connect")
          return
        }
        const response = await fetch("/api/watchlist", { signal: controller.signal })
        if (cancelled) return
        if (!response.ok) {
          const data = (await response.json()) as { error?: string }
          setError(data.error ?? "Could not load the watchlist.")
          setSetup(response.status === 401 ? "connect" : "ready")
          return
        }
        await readWatchlist(response, (batch) => {
          if (cancelled) return
          setRing((current) => growRing(current, batch))
          if (opened) return
          opened = true
          setSetup("ready")
        })
        if (!cancelled && !opened) setSetup("ready")
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return
        if (error instanceof WatchlistError) setError(error.message)
        else if (!opened) setError("Could not reach the local server.")
        if (!opened) setSetup("ready")
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const finishSpin = useCallback(() => setPhase("revealed"), [])
  const beginSpin = useCallback(() => {
    const next = pendingSpin.current
    if (!next) return
    pendingSpin.current = null
    setRing(next.ring)
    setSelectedIndex(next.index)
    setSpinId((value) => value + 1)
    setPhase("spinning")
  }, [])

  async function connect() {
    setConnecting(true)
    setError(null)
    try {
      const response = await fetch("/api/connect", { method: "POST" })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start the TMDB connection.")
        setConnecting(false)
        return
      }
      window.location.assign(data.url)
    } catch {
      setError("Could not start the TMDB connection.")
      setConnecting(false)
    }
  }

  function leaveResult(event: MouseEvent<HTMLElement>) {
    if (phase !== "revealed") return
    if (event.target instanceof Element && event.target.closest("form, button")) return
    setPhase("ready")
  }

  async function spin() {
    if (ring.length === 0 || phase === "spinning" || phase === "closing" || matching) return
    const feeling = mood.trim()
    if (!feeling) {
      setError("Enter a mood.")
      return
    }
    setMatching(true)
    setError(null)
    primeReel()
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mood: feeling,
          films: ring.map((film) => ({ name: film.name, overview: film.overview ?? "" })),
        }),
      })
      const data = (await response.json()) as { index?: number; match?: boolean; error?: string }
      if (!response.ok) {
        setError(data.error ?? "Jev could not pick a movie.")
        return
      }
      if (data.match === false) {
        missReel()
        setError("Your watchlist has no movie for current mood")
        return
      }
      if (
        typeof data.index !== "number" ||
        !Number.isInteger(data.index) ||
        data.index < 0 ||
        data.index >= ring.length
      ) {
        setError(data.error ?? "Jev could not pick a movie.")
        return
      }
      latchReel()
      setSelectedIndex(data.index)
      setSpinId((value) => value + 1)
      setPhase("spinning")
    } catch {
      setError("Jev could not pick a movie.")
    } finally {
      setMatching(false)
    }
  }

  const selected = selectedIndex != null ? ring[selectedIndex] : null
  const showRing = setup === "ready" && ring.length > 0

  return (
    <main
      className={`flex h-dvh flex-col bg-neutral-950 font-sans text-neutral-100 ${phase === "revealed" ? "cursor-pointer" : ""}`}
      onClick={leaveResult}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {setup === "loading" && !error && <WatchlistLoader />}
        {setup === "connect" && (
          <div className="flex flex-col items-center gap-6 px-6">
            <p className="max-w-sm text-center font-display text-4xl text-balance">Connect TMDB</p>
            <p className="max-w-sm text-center text-pretty text-neutral-400">
              Approve access once. The app reads your movie watchlist and keeps the title and poster.
            </p>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connecting}
              className="rounded-full bg-white px-6 py-3 text-neutral-950 disabled:opacity-60"
            >
              {connecting ? "Opening TMDB" : "Connect"}
            </button>
          </div>
        )}
        {setup === "ready" && ring.length === 0 && !error && (
          <p className="max-w-sm px-6 text-center text-pretty text-neutral-300">Your watchlist is empty.</p>
        )}
        {showRing && (
          <motion.div
            className="h-[min(68dvh,640px)] w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.6, ease: "easeOut" }}
          >
            <Carousel
              films={ring}
              phase={phase}
              selectedIndex={selectedIndex}
              spinId={spinId}
              onClosed={beginSpin}
              onSpinEnd={finishSpin}
            />
          </motion.div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="max-w-sm text-center text-pretty text-sm text-red-400">
            {error}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {matching ? "Matching a movie" : phase === "revealed" && selected ? selected.name : ""}
        </p>
        {showRing && (
          <form
            className="flex w-full max-w-sm flex-col items-center gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void spin()
            }}
          >
            <input
              value={mood}
              onChange={(event) => setMood(event.target.value)}
              placeholder="A mood"
              aria-label="Mood"
              autoComplete="off"
              disabled={matching || phase === "spinning" || phase === "closing"}
              className="w-full rounded-full border border-neutral-800 bg-transparent px-5 py-3 text-center text-neutral-100 outline-none placeholder:text-neutral-500 focus-visible:border-neutral-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={matching || phase === "spinning" || phase === "closing"}
              className={cn(
                "rounded-full bg-white px-8 py-3 text-neutral-950",
                (matching || phase === "spinning" || phase === "closing") && "opacity-60",
              )}
            >
              {matching ? "Matching" : phase === "spinning" || phase === "closing" ? "Spinning" : "Spin"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
