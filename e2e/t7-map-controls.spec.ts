import { expect, test } from "@playwright/test";

/**
 * Regression for the map controls the directory promises: the wheel zooms (no
 * button hunting), the home control frames the whole locality again, and a
 * marker opens the store card with its photo slot.
 */
test("T7: the map zooms with the wheel, recentres and opens a rich popup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/directorio");
  const map = page.locator(".leaflet-container").first();
  await expect(map).toBeVisible();

  const box = await map.boundingBox();
  if (!box) throw new Error("the map has no box");

  // Wheel zoom: enough gestures reach the maximum zoom and the + button locks.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let gesture = 0; gesture < 8; gesture += 1) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(80);
  }
  await expect(page.locator(".leaflet-control-zoom-in")).toHaveClass(
    /leaflet-disabled/,
  );

  // The home control returns to the whole locality.
  await page
    .getByRole("button", { name: "Ver toda la localidad de Kennedy" })
    .click();
  await expect(page.locator(".leaflet-control-zoom-in")).not.toHaveClass(
    /leaflet-disabled/,
  );

  // A marker opens the card with the shop and its photo slot.
  await page.locator(".leaflet-interactive").first().click();
  const popup = page.locator(".store-popup");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".store-popup__link")).toBeVisible();
  await expect(popup.locator(".store-popup__photo")).toBeVisible();

  expect(errors).toEqual([]);
});
