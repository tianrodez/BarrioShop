import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * A merchant hides a published store, goes back to the directory through the
 * header (client navigation, no reload) and must see it gone; showing it again
 * brings it back. The directory keeps its list in client state, so the server
 * snapshot has to remount it when the visibility changes.
 */
test("T9: hiding and showing a store updates the directory without a reload", async ({
  page,
}) => {
  await login(page, DEMO.panadera);

  const header = page.getByRole("banner");
  const hideButton = page.getByRole("button", { name: "Ocultar tienda" });
  const showButton = page.getByRole("button", { name: "Volver a mostrar" });

  // A previous failed run could leave the demo store hidden; start from a
  // known state instead of depending on the order the suite ran in.
  if (await showButton.count()) {
    await showButton.click();
    await expect(hideButton).toBeVisible();
  }

  try {
    // Visit the directory once so Next has a cached client entry for it.
    await header.getByRole("link", { name: "Directorio" }).click();
    await expect(
      page.getByRole("link", { name: "Panadería La Espiga" }).first(),
    ).toBeVisible();

    await header.getByRole("link", { name: "Mi panel" }).click();
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    await expect(showButton).toBeVisible();

    // Client navigation: the page must not need a reload.
    await header.getByRole("link", { name: "Directorio" }).click();
    await expect(page).toHaveURL(/\/directorio$/);
    await expect(
      page.getByRole("link", { name: "Panadería La Espiga" }),
    ).toHaveCount(0);

    await header.getByRole("link", { name: "Mi panel" }).click();
    await expect(showButton).toBeVisible();
    await showButton.click();
    await expect(hideButton).toBeVisible();

    await header.getByRole("link", { name: "Directorio" }).click();
    await expect(
      page.getByRole("link", { name: "Panadería La Espiga" }).first(),
    ).toBeVisible();
  } finally {
    // Leave the demo store published even when an assertion failed mid-way.
    await page.goto("/panel");
    if (await page.getByRole("button", { name: "Volver a mostrar" }).count()) {
      await page.getByRole("button", { name: "Volver a mostrar" }).click();
    }
  }
});
