import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { posterLarge, posterSrcSet, preloadPoster } from "./posters.ts"
import { followReel } from "./reel-audio"
import type { Film } from "./types"
import { CENTER_SCALE, coverScale, degreesFromFront, targetRotation } from "./spin"

type Phase = "ready" | "closing" | "spinning" | "revealed"

type CarouselProps = {
  films: Film[]
  phase: Phase
  selectedIndex: number | null
  spinId: number
  rotation: MotionValue<number>
  onClosed: () => void
  onSpinEnd: () => void
}

function useViewport() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return size
}

function ringLayout(count: number, cardWidth: number) {
  if (count <= 1) return { radius: 0, perspective: 1200 }
  const step = (2 * Math.PI) / count
  const radius = (cardWidth * 1.55) / (2 * Math.sin(step / 2))
  return { radius, perspective: Math.max(1200, radius * 3.2) }
}

export function Carousel({ films, phase, selectedIndex, spinId, rotation, onClosed, onSpinEnd }: CarouselProps) {
  const reveal = useMotionValue(0)
  const coverDrop = useMotionValue(0)
  const drag = useRef<{ id: number; x: number; t: number; velocity: number } | null>(null)
  const coast = useRef<{ stop: () => void } | null>(null)
  const manualStop = useRef<(() => void) | null>(null)
  const manualIdle = useRef<number | null>(null)
  const { width, height } = useViewport()
  const cardWidth = Math.max(104, Math.min(156, width * 0.2))
  const cardHeight = cardWidth * 1.5
  const { radius, perspective } = ringLayout(films.length, cardWidth)
  const stageHeight = Math.min(height * 0.68, 640)
  const paintedAtScale1 = cardHeight * (perspective / Math.max(perspective - radius, 1))
  const fittedScale = (stageHeight * 0.9) / paintedAtScale1
  const revealBoost = Math.max(0, fittedScale / CENTER_SCALE - 1)

  useEffect(() => {
    if (phase !== "closing") return
    let cancelled = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const controls = animate(reveal, 0, {
      duration: reduced ? 0 : 0.35,
      ease: "easeOut",
      onComplete: () => {
        if (!cancelled) onClosed()
      },
    })
    return () => {
      cancelled = true
      controls.stop()
    }
  }, [onClosed, phase, reveal])

  useEffect(() => {
    if (phase !== "spinning" || selectedIndex == null) return
    coast.current?.stop()
    let cancelled = false
    let current: { stop: () => void } | null = null
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let stopReel: (() => void) | null = null
    const spin = () => {
      preloadPoster(films[selectedIndex]?.poster ?? null)
      stopReel = reduced ? null : followReel(rotation, films.length)
      const target = targetRotation(rotation.get(), selectedIndex, films.length, 3)
      current = animate(rotation, target, {
        duration: reduced ? 0 : 5.8,
        ease: [0.2, 0.65, 0.3, 1],
        onComplete: () => {
          stopReel?.()
          stopReel = null
          if (!cancelled) onSpinEnd()
        },
      })
    }

    if (reveal.get() > 0.01 && !reduced) {
      current = animate(reveal, 0, {
        duration: 0.35,
        ease: "easeOut",
        onComplete: () => {
          if (!cancelled) spin()
        },
      })
    } else {
      reveal.set(0)
      spin()
    }

    return () => {
      cancelled = true
      current?.stop()
      stopReel?.()
      stopReel = null
    }
  }, [films.length, onSpinEnd, phase, reveal, rotation, selectedIndex, spinId])

  useEffect(() => {
    if (phase !== "revealed") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const controls = animate(reveal, 1, { duration: reduced ? 0 : 0.75, ease: "easeOut" })
    return () => controls.stop()
  }, [phase, reveal, spinId])

  useEffect(() => {
    if (phase !== "ready" || reveal.get() < 0.01) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const controls = animate(reveal, 0, { duration: reduced ? 0 : 0.45, ease: "easeOut" })
    return () => controls.stop()
  }, [phase, reveal])

  useEffect(() => {
    const place = () => {
      const shown = reveal.get()
      const scale = CENTER_SCALE * (1 + shown * revealBoost)
      coverDrop.set((paintedAtScale1 * scale) / 2)
    }
    place()
    return reveal.on("change", place)
  }, [coverDrop, paintedAtScale1, reveal, revealBoost])

  function stopCoast() {
    coast.current?.stop()
    coast.current = null
  }

  function stopManualAudio() {
    if (manualIdle.current !== null) {
      window.clearTimeout(manualIdle.current)
      manualIdle.current = null
    }
    manualStop.current?.()
    manualStop.current = null
  }

  function startManualAudio() {
    if (phase !== "ready" || films.length < 2) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (manualIdle.current !== null) {
      window.clearTimeout(manualIdle.current)
      manualIdle.current = null
    }
    if (!manualStop.current) {
      manualStop.current = followReel(rotation, films.length, { endClack: false })
    }
  }

  function scheduleManualStop(delay = 400) {
    if (manualIdle.current !== null) window.clearTimeout(manualIdle.current)
    manualIdle.current = window.setTimeout(stopManualAudio, delay)
  }

  // Manual follower shares followReel's singleton slot, so starting the spin
  // silences it; still drop our handle so a stale stop can't fire later.
  useEffect(() => {
    if (phase !== "ready") stopManualAudio()
  }, [phase])

  useEffect(() => stopManualAudio, [])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "ready" || films.length < 2 || reveal.get() > 0.02) return
    stopCoast()
    startManualAudio()
    scheduleManualStop(800)
    drag.current = { id: event.pointerId, x: event.clientX, t: event.timeStamp, velocity: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || event.pointerId !== state.id) return
    const dx = event.clientX - state.x
    const dt = event.timeStamp - state.t
    state.velocity = dt > 0 && dt < 50 ? dx / dt : 0
    state.x = event.clientX
    state.t = event.timeStamp
    rotation.set(rotation.get() + dx * 0.5)
    startManualAudio()
    scheduleManualStop(400)
  }

  function stepReel(direction: number) {
    if (phase !== "ready" || films.length < 2 || direction === 0) return
    stopCoast()
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduced) startManualAudio()
    coast.current = animate(rotation, rotation.get() + direction * (360 / films.length), {
      duration: reduced ? 0 : 0.3,
      ease: "easeOut",
      onComplete: stopManualAudio,
    })
  }

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (target.value.length > 0) return
      }
      const direction = event.key === "ArrowRight" ? -1 : event.key === "ArrowLeft" ? 1 : 0
      if (!direction) return
      event.preventDefault()
      stepReel(direction)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || event.pointerId !== state.id) return
    drag.current = null
    const extra = Math.max(-540, Math.min(540, state.velocity * 0.5 * 420))
    if (Math.abs(extra) < 12) {
      scheduleManualStop(250)
      return
    }
    if (manualIdle.current !== null) {
      window.clearTimeout(manualIdle.current)
      manualIdle.current = null
    }
    coast.current = animate(rotation, rotation.get() + extra, {
      duration: 0.85,
      ease: "easeOut",
      onComplete: stopManualAudio,
    })
  }

  const canDrag = phase === "ready" && films.length > 1
  const selected = selectedIndex != null ? films[selectedIndex] : null
  const coverWidth = (cardWidth / cardHeight) * paintedAtScale1 * CENTER_SCALE * (1 + revealBoost)

  return (
    <div className="relative h-full w-full">
      <div
        className={`relative z-0 h-full w-full overflow-hidden touch-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-neutral-500 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        role="group"
        aria-roledescription="carousel"
        aria-label="Watchlist reel"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative h-full w-full" style={{ perspective: `${perspective}px` }}>
          <div
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d", transform: "translateZ(0)" }}
          >
            {films.map((film, index) => (
              <PosterCard
                key={film.id}
                film={film}
                index={index}
                count={films.length}
                rotation={rotation}
                reveal={reveal}
                selected={index === selectedIndex}
                revealed={index === selectedIndex && phase === "revealed"}
                radius={radius}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                revealBoost={revealBoost}
              />
            ))}
          </div>
        </div>
      </div>
      {canDrag && (
        <>
          <button
            type="button"
            aria-label="Previous film"
            onClick={() => stepReel(1)}
            className="absolute top-1/2 left-4 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-600 bg-neutral-950/80 text-3xl leading-none text-neutral-100 hover:border-neutral-300"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            aria-label="Next film"
            onClick={() => stepReel(-1)}
            className="absolute top-1/2 right-4 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-600 bg-neutral-950/80 text-3xl leading-none text-neutral-100 hover:border-neutral-300"
          >
            <span aria-hidden>›</span>
          </button>
        </>
      )}
      {selected && (
        <motion.div
          className="pointer-events-none absolute left-1/2 z-10"
          style={{ top: "50%", x: "-50%", y: coverDrop, width: coverWidth, opacity: reveal }}
          aria-hidden={phase !== "revealed"}
        >
          <h1 className="line-clamp-3 -translate-y-full rounded-b-sm bg-neutral-950/90 px-3 pt-2.5 pb-2 text-center font-sans text-3xl font-medium leading-tight text-balance text-neutral-50">
            {selected.name}
          </h1>
        </motion.div>
      )}
    </div>
  )
}

function PosterCard({
  film,
  index,
  count,
  rotation,
  reveal,
  selected,
  revealed,
  radius,
  cardWidth,
  cardHeight,
  revealBoost,
}: {
  film: Film
  index: number
  count: number
  rotation: MotionValue<number>
  reveal: MotionValue<number>
  selected: boolean
  revealed: boolean
  radius: number
  cardWidth: number
  cardHeight: number
  revealBoost: number
}) {
  const [failed, setFailed] = useState(false)
  const step = 360 / count
  const transform = useTransform([rotation, reveal], (latest) => {
    const [angle, shown] = latest as [number, number]
    const rotationAngle = index * step + angle
    const reelScale = coverScale(rotationAngle, count)
    const finale = selected ? 1 + shown * revealBoost : 1
    return `rotateY(${rotationAngle}deg) translateZ(${radius}px) rotateY(${-rotationAngle}deg) scale(${reelScale * finale})`
  })
  const opacity = useTransform([rotation, reveal], (latest) => {
    const [angle, shown] = latest as [number, number]
    if (selected && shown > 0.01) return 1
    const facing = Math.cos(((index * step + angle) * Math.PI) / 180)
    if (facing < -0.15) return 0
    return (0.18 + 0.82 * Math.max(facing, 0)) * (1 - shown)
  })
  const zIndex = useTransform([rotation, reveal], (latest) => {
    const [angle, shown] = latest as [number, number]
    if (selected && shown > 0.05) return 10000
    const fromFront = degreesFromFront(index * step + angle)
    return Math.round(1000 - fromFront * 10)
  })

  return (
    <motion.div
      className="pointer-events-none absolute overflow-hidden rounded-sm shadow-lg"
      style={{
        width: cardWidth,
        height: cardHeight,
        left: "50%",
        top: "50%",
        marginLeft: -cardWidth / 2,
        marginTop: -cardHeight / 2,
        transform,
        opacity,
        zIndex,
      }}
    >
      {film.poster && !failed ? (
        <img
          src={revealed ? posterLarge(film.poster) : `https://image.tmdb.org/t/p/w342${film.poster}`}
          srcSet={revealed ? undefined : posterSrcSet(film.poster)}
          sizes={`${Math.round(cardWidth)}px`}
          alt=""
          draggable={false}
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="size-full bg-neutral-800" />
      )}
    </motion.div>
  )
}
