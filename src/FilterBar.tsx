import { useState } from "react"
import { decadesOf, type FilmFilter, NO_FILTER } from "../shared/filter.ts"
import type { Film } from "./types"

type Genre = { id: number; name: string }

type FilterBarProps = {
  films: Film[]
  genres: Genre[]
  filter: FilmFilter
  onChange: (filter: FilmFilter) => void
}

export function FilterBar({ films, genres, filter, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const present = new Set(films.flatMap((film) => film.genreIds))
  const shown = genres.filter((genre) => present.has(genre.id))
  const decades = decadesOf(films)
  const chip = (pressed: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm ${pressed ? "border-neutral-200 text-neutral-100" : "border-neutral-800 text-neutral-400"}`

  function toggle(list: number[], value: number) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  return (
    <div className="flex flex-col items-center gap-3 px-6">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="text-sm text-neutral-400">
        Filters
      </button>
      {open && (
        <>
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Genres">
            {shown.map((genre) => (
              <li key={genre.id}>
                <button
                  type="button"
                  aria-pressed={filter.genreIds.includes(genre.id)}
                  onClick={() => onChange({ ...filter, genreIds: toggle(filter.genreIds, genre.id) })}
                  className={chip(filter.genreIds.includes(genre.id))}
                >
                  {genre.name}
                </button>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Decades">
            {decades.map((decade) => (
              <li key={decade}>
                <button
                  type="button"
                  aria-pressed={filter.decades.includes(decade)}
                  onClick={() => onChange({ ...filter, decades: toggle(filter.decades, decade) })}
                  className={chip(filter.decades.includes(decade))}
                >
                  {decade}s
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onChange(NO_FILTER)} className="text-sm text-neutral-500">
            Clear
          </button>
        </>
      )}
    </div>
  )
}
