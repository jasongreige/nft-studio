import { expect, test } from "@playwright/test";

async function openBundledAssets(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore included art/ }).click();
}

async function openDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Try the demo/ }).click();
  await expect(page.getByRole("heading", { name: "Your artwork layers" })).toBeVisible();
}

test("offers private folder selection, a demo, and included artwork", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn your artwork into a collection." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose asset folder/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Try the demo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Explore included art/ })).toBeVisible();
  await expect(page.getByText("No uploads", { exact: true })).toBeVisible();
});

test("returns to source selection when the NFT Studio logo is clicked", async ({ page }) => {
  await openDemo(page);
  await page.locator(".topbar .brand").click();
  await expect(page.getByRole("heading", { name: "Turn your artwork into a collection." })).toBeVisible();
});

test("guides the user through detected assets and live rarity", async ({ page }) => {
  await openBundledAssets(page);
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
  await openDemo(page);
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Generate one preview" }).click();
  await expect(page.locator(".preview-card")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(".preview-card img")).toHaveAttribute("src", /^data:image\/png/);
  await expect(page.getByText("Combined probability")).toBeVisible();
});

test("runs the worker and downloads a complete ZIP", async ({ page }) => {
  await openDemo(page);
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
  await expect(page.getByRole("heading", { name: "Turn your artwork into a collection." })).toBeVisible();
  await page.getByRole("button", { name: /Try the demo/ }).click();
  await expect(page.locator(".stepper")).toBeVisible();
  await expect(page.locator(".layer-card").first()).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the stack" })).toBeVisible();
});

test("reads a selected collection folder without uploading it", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').evaluate(async (input) => {
    const canvas = document.createElement("canvas");
    canvas.width = 4; canvas.height = 4;
    canvas.getContext("2d")!.fillRect(0, 0, 4, 4);
    const png = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
    const files = [
      ["blue.png", "portfolio/backgrounds/blue.png"],
      ["robot.png", "portfolio/bodies/robot.png"],
      ["nothing.png", "portfolio/hats/nothing.png"],
    ].map(([name, relativePath]) => {
      const file = new File([png], name, { type: "image/png" });
      Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
      return file;
    });
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "Your artwork layers" })).toBeVisible();
  await expect(page.locator(".layer-card")).toHaveCount(3);
  await expect(page.getByText("portfolio", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change artwork" }).click();
  await expect(page.getByRole("heading", { name: "Turn your artwork into a collection." })).toBeVisible();
});
