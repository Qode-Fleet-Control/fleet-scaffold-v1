import { expect, test } from "@playwright/test";

test("home page shows the notes UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Scaffold" })).toBeVisible();
  await expect(page.getByPlaceholder("New note…")).toBeVisible();
});
