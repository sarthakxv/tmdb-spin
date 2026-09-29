import { useEffect, useRef, type ReactNode } from "react"
import { metaLine } from "./details.ts"
import { type Film, type FilmDetails, type Strength } from "./types"

type RevealPanelProps = {
  film: Film
  details: FilmDetails | null
  strength?: Strength | null
  onBack: () => void
  children?: ReactNode
}

const STRENGTH_LABEL = { strong: "Strong match", good: "Good match", loose: "Loose match" } as const

const action = "quiet-action"

export function RevealPanel({ film, details, strength, onBack, children }: RevealPanelProps) {
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    backRef.current?.focus()
  }, [])
  const overview = details?.overview || film.overview
  const meta = details ? metaLine(details) : ""
  return (
    <section
      data-keep-open
      aria-label={`${film.name} details`}
      className="reveal-panel"
    >
      {strength && <p className="reveal-strength">{STRENGTH_LABEL[strength]}</p>}
      {meta && <p className="reveal-meta">{meta}</p>}
      {details && details.genres.length > 0 && <p className="reveal-genres">{details.genres.join(", ")}</p>}
      {overview && <p className="reveal-overview line-clamp-3">{overview}</p>}
      {details && details.providers.length > 0 && (
        <div className="provider-row">
          <a
            href={details.watchLink ?? details.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2"
            aria-label={`Watch on ${details.providers.map((provider) => provider.name).join(", ")}`}
          >
            {details.providers.map((provider) =>
              provider.logo ? <img key={provider.name} src={provider.logo} alt="" className="size-8 rounded-md" /> : null,
            )}
          </a>
          <p className="text-xs text-[var(--muted)]">Streaming data from JustWatch</p>
        </div>
      )}
      <div className="reveal-actions">
        {children}
        {details?.trailer && (
          <a href={details.trailer} target="_blank" rel="noreferrer" className={action}>
            Trailer
          </a>
        )}
        <button type="button" disabled className={action}>WATCH</button>
        <button ref={backRef} type="button" onClick={onBack} className={action}>
          Back
        </button>
      </div>
    </section>
  )
}
