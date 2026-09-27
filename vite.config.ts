import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { tmdbPlugin } from "./server/plugin"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  return {
    plugins: [react(), tailwindcss(), tmdbPlugin(env.TMDB_API_KEY ?? "", env.TMDB_SESSION_ID)],
  }
})
