export function shareText(film: { name: string; year?: number | null }, mood: string): string {
  const title = film.year ? `${film.name} (${film.year})` : film.name
  const feeling = mood.trim()
  return feeling ? `Tonight's pick for “${feeling}”: ${title}` : `Tonight's pick: ${title}`
}
