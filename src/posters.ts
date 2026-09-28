const IMAGE_BASE = "https://image.tmdb.org/t/p"

export function posterSrcSet(path: string): string {
  return `${IMAGE_BASE}/w185${path} 185w, ${IMAGE_BASE}/w342${path} 342w`
}

export function posterLarge(path: string): string {
  return `${IMAGE_BASE}/w780${path}`
}

export function preloadPoster(path: string | null) {
  if (!path) return
  const image = new Image()
  image.decoding = "async"
  image.src = posterLarge(path)
}
