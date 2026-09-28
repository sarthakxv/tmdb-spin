import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4173", reducedMotion: "reduce" },
  webServer: {
    command: "npm run build && node --experimental-strip-types server/e2e.ts",
    url: "http://localhost:4173/api/health",
    reuseExistingServer: !process.env.CI,
  },
})
