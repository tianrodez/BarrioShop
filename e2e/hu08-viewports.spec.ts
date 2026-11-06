import { expect, test } from "@playwright/test";
import { DEMO, login, storeIdFromDirectory } from "./helpers";

/**
 * HU08 CA1: every screen fits the phone, the tablet and the desktop without a
 * horizontal scrollbar. This is the viewport proof U8 deferred to this unit.
 *
 * Each path is paired with something only that page shows, so a 404 or an
 * error screen can never pass the measurement.
 */
const VIEWPORTS = [
  { name: "phone", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

type Expected = { path: string; marker: string };

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  await page.waitForLoadState("networkidle");

  // The streamed shell can still trigger one navigation after load; retrying
  // the measurement is what keeps this honest instead of racing it.
  await expect(async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 10_000 });
}

test("HU08: the public screens fit every viewport", async ({ page }) => {
  const storeId = await storeIdFromDirectory(page, "Panadería La Espiga");

  const pages: Expected[] = [
    { path: "/", marker: "Las tiendas de tu barrio" },
    { path: "/directorio", marker: "Tiendas del barrio" },
    { path: "/login", marker: "Ingresar" },
    { path: "/registro", marker: "Crear cuenta" },
    { path: `/tienda/${storeId}`, marker: "Panadería La Espiga" },
    { path: `/pedido/${storeId}`, marker: "Finaliza tu pedido" },
  ];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);

    for (const { path, marker } of pages) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
});

test("HU08: the signed-in panel fits every viewport", async ({ page }) => {
  await login(page, DEMO.panadera);

  const pages: Expected[] = [
    { path: "/panel", marker: "Hola," },
    { path: "/panel/productos", marker: "Mi catálogo" },
  ];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);

    for (const { path, marker } of pages) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
});

test("HU08: the store creation form fits every viewport", async ({ page }) => {
  // A merchant with a store is redirected away from this screen, so the audit
  // uses a fresh client account and stops before submitting anything.
  const email = `hu08-${Date.now()}@barrioshop.demo`;

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Cliente Hu08");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("BarrioShop2026!");
  await page.getByRole("checkbox", { name: /Acepto la política/ }).click();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL("/");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/panel/tienda");
    await expect(page.getByText("Registra tu tienda").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
