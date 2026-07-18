import { expect, test } from "@playwright/test";

test("guides the user through detected assets and live rarity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your artwork layers" })).toBeVisible();
  await expect(page.locator(".layer-card")).toHaveCount(9);
  await expect(page.getByText("68 traits", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trait rarity" }).click();
  await expect(page.getByRole("heading", { name: "Set trait rarity" })).toBeVisible();
  const firstInput = page.locator(".percentage-input input").first();
  await firstInput.fill("0");
  await expect(page.getByRole("button", { name: "Save this layer" })).toBeDisabled();
  await expect(page.getByText(/Add .*% to reach 100%/)).toBeVisible();
});

test("generates a real browser preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Generate one preview" }).click();
  await expect(page.locator(".preview-card")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(".preview-card img")).toHaveAttribute("src", /^data:image\/png/);
  await expect(page.getByText("Combined probability")).toBeVisible();
});

test("runs the worker and downloads a complete ZIP", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Generate" }).click();
  await page.getByRole("textbox", { name: /Image name/ }).fill("My Babies");
  await page.getByRole("spinbutton", { name: "How many NFTs?" }).fill("2");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^my_babies-collection-\d{8}-\d{6}\.zip$/);
  await expect(page.getByText(/Generated 2 NFTs/)).toBeVisible({ timeout: 30_000 });
});

test("keeps the workflow usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".stepper")).toBeVisible();
  await expect(page.locator(".layer-card").first()).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the stack" })).toBeVisible();
});
