import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  await request.post("/api/disconnect")
})

test("connecting shows the watchlist, and a mood reveals its film", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await expect(page.getByRole("group", { name: "Cineroulette reel" })).toBeVisible()
  await page.getByRole("textbox", { name: "Mood", exact: true }).fill("space")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("heading", { name: "Interstellar" })).toBeVisible()
  await expect(page.getByText("2014 · 2h 49m · ★ 8.4")).toBeVisible()
  await expect(page.getByRole("button", { name: "WATCH", exact: true })).toBeDisabled()
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
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible()
  await page.getByRole("button", { name: "1990s" }).click()
  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("dialog", { name: "Filters" })).not.toBeVisible()
  await page.getByRole("button", { name: "Surprise me" }).click()
  await expect(page.getByRole("heading", { name: "Heat" })).toBeVisible()
})

test("the reel fits below the heading with neighboring covers close together", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 })
  await page.route("**/api/watchlist?media=movie", (route) => route.fulfill({
    status: 200,
    contentType: "application/x-ndjson",
    body: `${JSON.stringify({ films: Array.from({ length: 24 }, (_, index) => ({
      id: index + 1, name: `Film ${index + 1}`, poster: null, overview: "", year: 2000, genreIds: [], media: "movie",
    })) })}\n`,
  }))
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await expect(page.getByRole("group", { name: "Cineroulette reel" })).toBeVisible()

  const { frame, front, neighbor } = await page.evaluate(() => {
    const frame = document.querySelector(".reel-frame")!.getBoundingClientRect()
    const covers = [...document.querySelectorAll<HTMLElement>(".poster-card")].map((element) => ({
      rect: element.getBoundingClientRect(), opacity: Number(getComputedStyle(element).opacity),
    }))
    const front = covers.reduce((largest, cover) => cover.rect.height > largest.rect.height ? cover : largest).rect
    const neighbor = covers.filter(({ rect, opacity }) => opacity > 0.8 && rect.width > front.width * 0.55 && rect.left > front.left)
      .sort((a, b) => a.rect.left - b.rect.left)[0].rect
    return { frame: { top: frame.top, bottom: frame.bottom }, front: { top: front.top, right: front.right, bottom: front.bottom }, neighbor: { left: neighbor.left } }
  })
  expect(front.top).toBeGreaterThanOrEqual(frame.top)
  expect(front.bottom).toBeLessThanOrEqual(frame.bottom)
  expect(neighbor.left - front.right).toBeGreaterThanOrEqual(-8)
  expect(neighbor.left - front.right).toBeLessThanOrEqual(20)
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
  await expect(page.getByRole("button", { name: "Previous film" })).toBeVisible()
  await page.getByRole("button", { name: "Next film" }).click()
  await page.keyboard.press("ArrowLeft")
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
