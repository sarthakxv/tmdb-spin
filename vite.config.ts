import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type PluginOption } from "vite"
import { createApp } from "./server/app.ts"
import { readConfig } from "./server/config.ts"
import { liveDeps } from "./server/live.ts"
import { apiPlugin } from "./server/plugin.ts"

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (command === "serve") {
    const config = readConfig(loadEnv(mode, process.cwd(), ""))
    plugins.push(apiPlugin(createApp(config, liveDeps(config))))
  }
  return { plugins }
})
