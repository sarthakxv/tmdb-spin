import { readFileSync, writeFileSync } from "node:fs"

const sessionFile = ".tmdb-session"

export function readSession(envSession: string | undefined): string | null {
  const fromEnv = envSession?.trim()
  if (fromEnv) return fromEnv
  try {
    const stored = readFileSync(sessionFile, "utf8").trim()
    return stored || null
  } catch {
    return null
  }
}

export function writeSession(sessionId: string) {
  writeFileSync(sessionFile, sessionId, { mode: 0o600 })
}
