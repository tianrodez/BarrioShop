import { expect, test } from "@playwright/test";
import { distanceInMetres } from "./helpers";

/**
 * T4 (formulación §13): a client asks for the stores near them and reads the
 * distance on each card. The browser permission is granted by the test, which
 * is what the "Buscar tiendas cerca" button asks for (HU10 CA1).
 */
test.use({
  geolocation: { latitude: 4.5996, longitude: -74.1377 },
  permissions: ["geolocation"],
});

test("T4: a client searches a store near their location", async ({ page }) => {
  await page.goto("/directorio");
  await page.getByRole("button", { name: "Buscar tiendas cerca" }).click();

  // HU10 CA5: the page says the position is used for the search only.
  await expect(page.getByText(/No la guardamos/)).toBeVisible();

  const cards = page.locator('li:has(a[href^="/tienda/"])');
  await expect(cards.first()).toBeVisible();

  const rows = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.textContent ?? ""),
  );

  // HU07 CA3 puts featured stores first, so proximity is only ordered inside
  // each group: assert the grouping and the order within both.
  const featuredFlags = rows.map((text) => text.includes("Destacada"));
  expect(featuredFlags).toEqual(
    [...featuredFlags].sort((a, b) => Number(b) - Number(a)),
  );

  for (const featured of [true, false]) {
    const distances = rows
      .filter((_, index) => featuredFlags[index] === featured)
      .map(
        (text) =>
          text.match(/a\s+(?:menos de 100 m|[\d.]+\s+m|[\d,]+\s+km)/)?.[0],
      )
      .map((label) => (label ? distanceInMetres(label) : null))
      .filter((metres): metres is number => metres !== null);

    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  }

  expect(featuredFlags.length).toBeGreaterThanOrEqual(2);
});
