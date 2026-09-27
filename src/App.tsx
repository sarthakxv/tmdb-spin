import { motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { Carousel } from "./Carousel"
import { cn } from "./lib/cn"
import { RING_SIZE, sampleFilms } from "./sample"
import type { Film } from "./types"
import { readWatchlist, WatchlistError } from "./watchlist"

type Setup = "loading" | "key" | "connect" | "ready"

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
  const [films, setFilms] = useState<Film[]>([])
  const [ring, setRing] = useState<Film[]>([])
  const [phase, setPhase] = useState<"ready" | "closing" | "spinning" | "revealed">("ready")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [spinId, setSpinId] = useState(0)
  const pendingSpin = useRef<{ ring: Film[]; index: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

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
        )) as {
          configured: boolean
          connected: boolean
        }
        if (cancelled) return
        if (!health.configured) {
          setSetup("key")
          return
        }
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
          setFilms((current) => current.concat(batch))
          if (opened) return
          opened = true
          setRing(sampleFilms(batch, RING_SIZE))
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
    if (event.target instanceof Element && event.target.closest("button")) return
    setPhase("ready")
  }

  function spin() {
    if (ring.length === 0) return
    if (phase === "revealed") {
      const nextRing = sampleFilms(films, RING_SIZE)
      pendingSpin.current = { ring: nextRing, index: Math.floor(Math.random() * nextRing.length) }
      setPhase("closing")
      return
    }
    setSelectedIndex(Math.floor(Math.random() * ring.length))
    setSpinId((value) => value + 1)
    setPhase("spinning")
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
        {setup === "key" && (
          <p className="max-w-sm px-6 text-center text-pretty text-neutral-300">
            Add TMDB_API_KEY to .env and restart.
          </p>
        )}
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
        <div className="flex min-h-16 items-center">
          {phase === "revealed" && selected && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="max-w-lg text-center font-display text-4xl text-balance"
            >
              {selected.name}
            </motion.h1>
          )}
        </div>
        {error && <p className="max-w-sm text-center text-pretty text-sm text-red-400">{error}</p>}
        <p className="sr-only" aria-live="polite">
          {phase === "revealed" && selected ? selected.name : ""}
        </p>
        {showRing && (
          <button
            type="button"
            onClick={spin}
            disabled={phase === "spinning" || phase === "closing"}
            className={cn(
              "rounded-full bg-white px-8 py-3 text-neutral-950",
              (phase === "spinning" || phase === "closing") && "opacity-60",
            )}
          >
            {phase === "spinning" || phase === "closing" ? "Spinning" : phase === "revealed" ? "Spin again" : "Spin"}
          </button>
        )}
      </div>
    </main>
  )
}
