import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  await request.post("/api/disconnect")
})

test("connecting shows the watchlist, and a mood reveals its film", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await expect(page.getByRole("group", { name: "Watchlist reel" })).toBeVisible()
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("space")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("heading", { name: "Interstellar" })).toBeVisible()
  await expect(page.getByText("2014 · 2h 49m · ★ 8.4")).toBeVisible()
  await page.getByRole("button", { name: "Back" }).click()
  await expect(page.getByRole("textbox", { name: "Mood", exact: true })).toBeVisible()
})

test("something else picks a different film for the same mood", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("space")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("heading", { name: "Interstellar" })).toBeVisible()
  await page.getByRole("button", { name: "Something else" }).click()
  await expect(page.getByRole("heading", { name: "The Martian" })).toBeVisible()
})

test("a mood chip spins that mood", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("button", { name: "Cozy" }).click()
  await expect(page.getByRole("heading", { name: "Paddington" })).toBeVisible()
})

test("a blank mood spins at random", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("button", { name: "Surprise me" }).click()
  await expect(page.getByRole("region", { name: /details/ })).toBeVisible()
})

test("a mood nothing fits says so", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("western")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("alert")).toContainText(/no (movie|show)/)
})

test("a watched film can be removed", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("heist")
  await page.getByRole("button", { name: "Spin" }).click()
  await page.getByRole("button", { name: "Watched it" }).click()
  await page.getByRole("button", { name: "Remove from TMDB watchlist?" }).click()
  await expect(page.getByRole("textbox", { name: "Mood", exact: true })).toBeVisible()
})

test("filtering to one decade keeps other films out", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("button", { name: "Filters" }).click()
  await page.getByRole("button", { name: "1990s" }).click()
  await page.getByRole("button", { name: "Surprise me" }).click()
  await expect(page.getByRole("heading", { name: "Heat" })).toBeVisible()
})

test("the TV watchlist spins separately", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("radio", { name: "TV" }).click()
  await page.getByRole("button", { name: "Surprise me" }).click()
  await expect(page.getByRole("heading", { name: "Breaking Bad" })).toBeVisible()
})

test("the reel works from the keyboard", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  const reel = page.getByRole("group", { name: "Watchlist reel" })
  await reel.focus()
  await page.keyboard.press("ArrowRight")
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("space")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Interstellar" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Back" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("textbox", { name: "Mood", exact: true })).toBeFocused()
})

test("disconnecting returns to Connect", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeVisible()
})
