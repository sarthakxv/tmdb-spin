import { useRef, useState } from "react"
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
  const dialog = useRef<HTMLDialogElement>(null)
  const present = new Set(films.flatMap((film) => film.genreIds))
  const shown = genres.filter((genre) => present.has(genre.id))
  const decades = decadesOf(films)
  const chip = (pressed: boolean) => `filter-chip ${pressed ? "is-active" : ""}`

  function toggle(list: number[], value: number) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  return (
    <div className="filter-bar">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { dialog.current?.showModal(); setOpen(true) }} className="filter-toggle">
        Filters {(filter.genreIds.length > 0 || filter.decades.length > 0) && <span className="filter-count">{filter.genreIds.length + filter.decades.length}</span>}
      </button>
      <dialog ref={dialog} className="filter-dialog" aria-labelledby="filter-title" onClose={() => setOpen(false)}>
        <div className="filter-dialog-head">
          <div>
            <p className="eyebrow">MAKE IT YOURS</p>
            <h2 id="filter-title">Filters</h2>
          </div>
          <button type="button" className="filter-close" aria-label="Close filters" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <div className="filter-options">
          <h3>Genres</h3>
          <ul className="filter-list" aria-label="Genres">
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
          <h3>Decades</h3>
          <ul className="filter-list" aria-label="Decades">
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
        </div>
        <div className="filter-dialog-actions">
          <button type="button" onClick={() => onChange(NO_FILTER)} className="filter-clear">Clear all</button>
          <button type="button" onClick={() => dialog.current?.close()} className="primary-action">Done</button>
        </div>
      </dialog>
    </div>
  )
}
