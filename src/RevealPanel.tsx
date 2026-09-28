import type { ReactNode } from "react"
import { metaLine } from "./details.ts"
import { type Film, type FilmDetails, type Strength, tmdbLink } from "./types"

type RevealPanelProps = {
  film: Film
  details: FilmDetails | null
  strength?: Strength | null
  onBack: () => void
  children?: ReactNode
}

const STRENGTH_LABEL = { strong: "Strong match", good: "Good match", loose: "Loose match" } as const

const action = "rounded-full border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200 hover:border-neutral-500"

export function RevealPanel({ film, details, strength, onBack, children }: RevealPanelProps) {
  const overview = details?.overview || film.overview
  const meta = details ? metaLine(details) : ""
  return (
    <section
      data-keep-open
      aria-label={`${film.name} details`}
      className="flex w-full max-w-md flex-col items-center gap-3 text-center"
    >
      {strength && <p className="text-xs uppercase tracking-wide text-neutral-500">{STRENGTH_LABEL[strength]}</p>}
      {meta && <p className="text-sm tabular-nums text-neutral-400">{meta}</p>}
      {details && details.genres.length > 0 && <p className="text-sm text-neutral-500">{details.genres.join(", ")}</p>}
      {overview && <p className="line-clamp-3 text-pretty text-sm text-neutral-300">{overview}</p>}
      {details && details.providers.length > 0 && (
        <div className="flex flex-col items-center gap-1">
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
          <p className="text-xs text-neutral-600">Streaming data from JustWatch</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {children}
        {details?.trailer && (
          <a href={details.trailer} target="_blank" rel="noreferrer" className={action}>
            Trailer
          </a>
        )}
        <a href={details?.link ?? tmdbLink("movie", film.id)} target="_blank" rel="noreferrer" className={action}>
          TMDB
        </a>
        <button type="button" onClick={onBack} className={action}>
          Back
        </button>
      </div>
    </section>
  )
}
