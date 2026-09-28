import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  await request.post("/api/disconnect")
})

test("connecting shows the watchlist, and a mood reveals its film", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await expect(page.getByRole("group", { name: "Watchlist reel" })).toBeVisible()
  await page.getByLabel("Mood").fill("space")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("heading", { name: "Interstellar" })).toBeVisible()
  await expect(page.locator('img[src*="w780/interstellar.jpg"]')).toBeVisible()
})

test("a mood nothing fits says so", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByLabel("Mood").fill("western")
  await page.getByRole("button", { name: "Spin" }).click()
  await expect(page.getByRole("alert")).toContainText("no movie")
})

test("disconnecting returns to Connect", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Connect", exact: true }).click()
  await page.getByRole("button", { name: "Disconnect", exact: true }).click()
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeVisible()
})
