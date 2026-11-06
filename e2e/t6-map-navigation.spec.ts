import { expect, test } from "@playwright/test";

/**
 * Regression for the crash the directory used to throw after visiting a store:
 * "Cannot read properties of undefined (reading 'appendChild')" and "Map
 * container is being reused by another instance". The map now owns its Leaflet
 * instance, so leaving the page and coming back must keep the console clean.
 */
test("T6: the map survives going to a store and coming back", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/directorio");
  await expect(page.locator(".leaflet-container")).toBeVisible();

  await page.getByRole("link", { name: "Panadería La Espiga" }).click();
  await expect(page).toHaveURL(/\/tienda\/[0-9a-f-]{36}/);
  await expect(page.locator(".leaflet-container")).toBeVisible();

  // Browser history.
  await page.goBack();
  await expect(page.locator(".leaflet-container")).toBeVisible();

  // Client-side navigation, which is what triggers the router cache.
  await page.getByRole("link", { name: "Panadería La Espiga" }).click();
  await expect(page).toHaveURL(/\/tienda\/[0-9a-f-]{36}/);
  await page.goBack();
  await expect(page.locator(".leaflet-container")).toBeVisible();

  expect(errors).toEqual([]);
});
