import { readFileSync, rmSync, writeFileSync } from "node:fs"

export type Session = { id: string; tmdbSessionId: string | null; requestToken: string | null }

export const LOCAL_SESSION = "local"

export type SessionStore = {
  get(id: string): Session | null
  save(session: Session): void
  delete(id: string): void
}

export function memoryStore(): SessionStore {
  const rows = new Map<string, Session>()
  return {
    get(id) {
      const session = rows.get(id)
      return session ? { ...session } : null
    },
    save(session) {
      rows.set(session.id, { ...session })
    },
    delete(id) {
      rows.delete(id)
    },
  }
}

export function fileStore(file: string): SessionStore {
  let requestToken: string | null = null

  function stored() {
    try {
      return readFileSync(file, "utf8").trim() || null
    } catch {
      return null
    }
  }

  return {
    get(id) {
      const tmdbSessionId = stored()
      if (!tmdbSessionId && !requestToken) return null
      return { id, tmdbSessionId, requestToken }
    },
    save(session) {
      requestToken = session.requestToken
      if (session.tmdbSessionId) writeFileSync(file, session.tmdbSessionId, { mode: 0o600 })
      else rmSync(file, { force: true })
    },
    delete() {
      requestToken = null
      rmSync(file, { force: true })
    },
  }
}
