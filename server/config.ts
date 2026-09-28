export type Config = { tmdbApiKey: string; openRouterKey: string; envSession: string | null }

export class ConfigError extends Error {}

const REQUIRED = ["TMDB_API_KEY", "OPENROUTER_API_KEY"] as const

export function readConfig(env: Record<string, string | undefined>): Config {
  const missing = REQUIRED.filter((name) => !env[name]?.trim())
  if (missing.length > 0) throw new ConfigError(`Add ${missing.join(", ")} to .env and restart.`)
  return {
    tmdbApiKey: env.TMDB_API_KEY!.trim(),
    openRouterKey: env.OPENROUTER_API_KEY!.trim(),
    envSession: env.TMDB_SESSION_ID?.trim() || null,
  }
}
