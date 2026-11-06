import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * The store profile renders a Leaflet map with panes up to z-index 800. The
 * report dialog used to sit at z-50, so the map painted over the form and the
 * textarea was unreachable. This checks the dialog really is the top layer.
 */
test("T8: the report dialog sits above the map and closes with Escape", async ({
  page,
}) => {
  await login(page, DEMO.panadera);
  await page.goto("/directorio");
  await page.getByRole("link", { name: "Panadería La Espiga" }).first().click();
  await page
    .getByRole("button", { name: "Reportar Panadería La Espiga" })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  if (!box) throw new Error("the dialog has no box");

  const onTop = await page.evaluate(
    ({ x, y }) =>
      Boolean(document.elementFromPoint(x, y)?.closest('[role="dialog"]')),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(onTop).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
