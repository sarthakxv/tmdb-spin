import { motion, useMotionValue, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { type FilmFilter, matchesFilter, NO_FILTER } from "../shared/filter.ts"
import { Carousel } from "./Carousel"
import { FilterBar } from "./FilterBar"
import { visitorRegion } from "./details"
import { cn } from "./lib/cn"
import { RevealPanel } from "./RevealPanel"
import { MoodChips } from "./MoodChips"
import { moodChips, MOOD_SUGGESTIONS, rememberMood } from "./moods"
import { readPreference, writePreference } from "./preferences"
import { shareText } from "./share"
import { latchReel, missReel, primeReel, setMuted } from "./reel-audio"
import { growRing, placePick, randomPick, RING_LIMIT, sampleFilms } from "./sample"
import { frontIndex } from "./spin"
import { tmdbLink, type Film, type FilmDetails, type Media, type Strength } from "./types"
import { readWatchlist, WatchlistError } from "./watchlist"

type Setup = "loading" | "connect" | "ready"

function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (asking ? onConfirm() : setAsking(true))}
      className="rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200 hover:border-red-400"
    >
      {asking ? "Remove from TMDB watchlist?" : "Watched it"}
    </button>
  )
}

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
  const [watchlist, setWatchlist] = useState<Film[]>([])
  const [filter, setFilter] = useState<FilmFilter>(NO_FILTER)
  const filterRef = useRef(filter)
  filterRef.current = filter
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [ring, setRing] = useState<Film[]>([])
  const ringRef = useRef(ring)
  const moodRef = useRef<HTMLInputElement>(null)
  ringRef.current = ring
  const rotation = useMotionValue(0)
  const [phase, setPhase] = useState<"ready" | "closing" | "spinning" | "revealed">("ready")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [spinId, setSpinId] = useState(0)
  const pendingSpin = useRef<{ ring: Film[]; index: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [mood, setMood] = useState("")
  const [recent, setRecent] = useState<string[]>(() => readPreference("recent-moods", []))
  const [matching, setMatching] = useState(false)
  const [picked, setPicked] = useState<{ mood: string; ids: number[] }>({ mood: "", ids: [] })
  const [strength, setStrength] = useState<Strength | null>(null)
  const [copied, setCopied] = useState(false)
  const [muted, setMutedState] = useState(() => readPreference("muted", false))
  const [media, setMedia] = useState<Media>(() => (readPreference<string>("media", "movie") === "tv" ? "tv" : "movie"))

  useEffect(() => {
    const denied = new URLSearchParams(window.location.search).get("auth") === "denied"
    if (denied) {
      setError("TMDB didn't approve the connection.")
      window.history.replaceState(null, "", "/")
    }

    setWatchlist([])
    setRing([])
    setSelectedIndex(null)
    setPhase("ready")
    setPicked({ mood: "", ids: [] })
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
        const response = await fetch(`/api/watchlist?media=${media}`, { signal: controller.signal })
        if (cancelled) return
        if (!response.ok) {
          const data = (await response.json()) as { error?: string }
          setError(data.error ?? "Could not load the watchlist.")
          setSetup(response.status === 401 ? "connect" : "ready")
          return
        }
        await readWatchlist(response, (batch) => {
          if (cancelled) return
          setWatchlist((current) => current.concat(batch))
          setRing((current) =>
            growRing(
              current,
              batch.filter((film) => matchesFilter(film, filterRef.current)),
              Math.random,
              RING_LIMIT,
            ),
          )
          if (opened) return
          opened = true
          setSetup("ready")
        })
        if (!cancelled && !opened) setSetup("ready")
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return
        if (error instanceof WatchlistError) {
          setError(error.message)
          if (error.message.includes("rejected the credentials")) {
            setWatchlist([])
            setRing([])
            setSetup("connect")
            return
          }
        } else if (!opened) setError("Could not reach the local server.")
        if (!opened) setSetup("ready")
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [media])

  useEffect(() => {
    if (setup !== "ready") return
    const controller = new AbortController()
    fetch(`/api/genres/${media}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ id: number; name: string }[]>) : []))
      .then((data) => {
        if (Array.isArray(data)) setGenres(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [setup, media])

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
    if (event.target instanceof Element && event.target.closest("form, button, a, [data-keep-open]")) return
    setPhase("ready")
  }

  function chooseFilter(next: FilmFilter) {
    setFilter(next)
    setRing(sampleFilms(watchlist.filter((film) => matchesFilter(film, next)), RING_LIMIT))
    setSelectedIndex(null)
    setPhase("ready")
  }

  async function spin(override?: string) {
    if (ring.length === 0 || phase === "spinning" || phase === "closing" || matching) return
    const feeling = (override ?? mood).trim()
    if (!feeling) {
      const film = randomPick(
        watchlist.filter((item) => matchesFilter(item, filter)),
        selected?.id ?? null,
      )
      if (!film) return
      setStrength(null)
      const current = ringRef.current
      const count = current.length
      const back = count === 0 ? 0 : (frontIndex(rotation.get(), count) + Math.floor(count / 2)) % count
      const placed = placePick(current, film, back)
      latchReel()
      setRing(placed.ring)
      setSelectedIndex(placed.index)
      setSpinId((value) => value + 1)
      setPhase("spinning")
      return
    }
    const key = feeling.toLowerCase()
    const exclude = picked.mood === key ? picked.ids : []
    setMatching(true)
    setError(null)
    primeReel()
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mood: feeling, exclude, filter, media }),
      })
      const data = (await response.json()) as { film?: Film; match?: boolean; strength?: Strength | null; error?: string }
      if (response.status === 401) {
        setWatchlist([])
        setRing([])
        setSelectedIndex(null)
        setPhase("ready")
        setSetup("connect")
        setError(data.error ?? "TMDB access ended. Connect again.")
        return
      }
      if (!response.ok) {
        setError(data.error ?? "Jev could not pick a movie.")
        return
      }
      if (data.match === false) {
        missReel()
        setPicked({ mood: key, ids: [] })
        setError(
          exclude.length > 0
            ? "Nothing else in your watchlist fits this mood."
            : media === "tv"
              ? "Your watchlist has no show for this mood."
              : "Your watchlist has no movie for this mood.",
        )
        return
      }
      if (!data.film) {
        setError("Jev could not pick a movie.")
        return
      }
      const current = ringRef.current
      const count = current.length
      const back = count === 0 ? 0 : (frontIndex(rotation.get(), count) + Math.floor(count / 2)) % count
      const nextRecent = rememberMood(recent, feeling)
      setRecent(nextRecent)
      writePreference("recent-moods", nextRecent)
      setPicked({ mood: key, ids: [...exclude, data.film.id] })
      setStrength(data.strength ?? null)
      const placed = placePick(current, data.film, back)
      setRing(placed.ring)
      latchReel()
      setSelectedIndex(placed.index)
      setSpinId((value) => value + 1)
      setPhase("spinning")
    } catch {
      setError("Jev could not pick a movie.")
    } finally {
      setMatching(false)
    }
  }

  async function sharePick() {
    if (!selected) return
    const url = details?.link ?? tmdbLink(selected.media, selected.id)
    const text = shareText(selected, mood)
    if (navigator.share) {
      await navigator.share({ title: selected.name, text, url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
    setCopied(true)
  }

  async function removeSelected() {
    if (!selected) return
    const response = await fetch(`/api/watchlist/${selected.media}/${selected.id}`, { method: "DELETE" }).catch(() => null)
    if (!response?.ok) {
      setError("TMDB could not remove that film.")
      return
    }
    const id = selected.id
    setWatchlist((current) => current.filter((film) => film.id !== id))
    setRing((current) => current.filter((film) => film.id !== id))
    setSelectedIndex(null)
    setPhase("ready")
  }

  async function disconnect() {
    await fetch("/api/disconnect", { method: "POST" }).catch(() => {})
    setWatchlist([])
    setRing([])
    setFilter(NO_FILTER)
    setSelectedIndex(null)
    setPhase("ready")
    setError(null)
    setSetup("connect")
  }

  useEffect(() => setMuted(muted), [muted])

  useEffect(() => {
    if (phase !== "revealed") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhase("ready")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase])

  useEffect(() => {
    if (phase === "ready") moodRef.current?.focus({ preventScroll: true })
  }, [phase])

  const selected = selectedIndex != null ? ring[selectedIndex] : null
  const selectedId = selected?.id ?? null
  const showing = phase === "spinning" || phase === "revealed"
  const [details, setDetails] = useState<FilmDetails | null>(null)
  useEffect(() => {
    setDetails(null)
    setCopied(false)
    if (selectedId == null || !showing) return
    const controller = new AbortController()
    fetch(`/api/titles/${selected?.media ?? "movie"}/${selectedId}?region=${visitorRegion()}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<FilmDetails>) : null))
      .then((data) => {
        if (data) setDetails(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [selectedId, showing])
  const showRing = setup === "ready" && ring.length > 0

  return (
    <main
      className={`flex h-dvh flex-col bg-neutral-950 font-sans text-neutral-100 ${phase === "revealed" ? "cursor-pointer" : ""}`}
      onClick={leaveResult}
    >
      {setup === "ready" && (
        <div className="flex items-center justify-between px-6 pt-4">
          <button
            type="button"
            aria-pressed={muted}
            aria-label="Mute reel sound"
            onClick={() => {
              setMutedState(!muted)
              writePreference("muted", !muted)
            }}
            className="rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-200"
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <div role="radiogroup" aria-label="Watchlist" className="flex rounded-full border border-neutral-800 p-1 text-sm">
            {(["movie", "tv"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={media === option}
                onClick={() => {
                  setMedia(option)
                  writePreference("media", option)
                }}
                className={cn("rounded-full px-4 py-1.5", media === option ? "bg-white text-neutral-950" : "text-neutral-400")}
              >
                {option === "movie" ? "Movies" : "TV"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void disconnect()} className="text-sm text-neutral-500 hover:text-neutral-300">
            Disconnect
          </button>
        </div>
      )}
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
        {setup === "ready" && watchlist.length > 0 && (
          <FilterBar films={watchlist} genres={genres} filter={filter} onChange={chooseFilter} />
        )}
        {setup === "ready" && ring.length === 0 && !error && (
          <p className="max-w-sm px-6 text-center text-pretty text-neutral-300">
            {watchlist.length > 0 ? "No films match these filters." : "Your watchlist is empty."}
          </p>
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
              rotation={rotation}
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
        {phase === "revealed" && selected ? (
          <RevealPanel film={selected} details={details} strength={strength} onBack={() => setPhase("ready")}>
            <RemoveButton key={selected.id} onConfirm={() => void removeSelected()} />
            <button
              type="button"
              onClick={() => void sharePick()}
              className="rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200"
            >
              {copied ? "Link copied" : "Share"}
            </button>
            {mood.trim() && (
              <button
                type="button"
                onClick={() => void spin()}
                className="rounded-full bg-white px-5 py-2.5 text-sm text-neutral-950"
              >
                Something else
              </button>
            )}
          </RevealPanel>
        ) : (
          showRing && (
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
              placeholder="A mood, or leave it blank"
              ref={moodRef}
              aria-label="Mood"
              autoComplete="off"
              disabled={matching || phase === "spinning" || phase === "closing"}
              className="w-full rounded-full border border-neutral-800 bg-transparent px-5 py-3 text-center text-neutral-100 outline-none placeholder:text-neutral-500 focus-visible:border-neutral-400 disabled:opacity-60"
            />
            <MoodChips
              moods={moodChips(recent, MOOD_SUGGESTIONS)}
              disabled={matching || phase === "spinning" || phase === "closing"}
              onPick={(pickedMood) => {
                setMood(pickedMood)
                void spin(pickedMood)
              }}
            />
            <button
              type="submit"
              disabled={matching || phase === "spinning" || phase === "closing"}
              className={cn(
                "rounded-full bg-white px-8 py-3 text-neutral-950",
                (matching || phase === "spinning" || phase === "closing") && "opacity-60",
              )}
            >
              {matching ? "Matching" : phase === "spinning" || phase === "closing" ? "Spinning" : mood.trim() ? "Spin" : "Surprise me"}
            </button>
          </form>
          )
        )}
      </div>
    </main>
  )
}
