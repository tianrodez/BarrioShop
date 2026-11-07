import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * The demo seed creates the administrator, so a fresh database never needs a
 * manual promotion before showing the admin console (HU09 CA4).
 */
test("T10: the seeded administrator reaches the admin panel", async ({
  page,
}) => {
  await login(page, DEMO.admin);

  await expect(
    page.getByRole("heading", { name: "Panel de administración" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Tiendas en revisión" }),
  ).toBeVisible();
});
