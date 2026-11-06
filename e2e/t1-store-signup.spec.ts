import { expect, test } from "@playwright/test";
import { PHOTO, PASSWORD } from "./helpers";

/**
 * T1 (formulación §13): a merchant registers and creates the store with its
 * profile in one sitting, without help.
 */
test("T1: a merchant registers and creates the store with its profile", async ({
  page,
}) => {
  const email = `t1-${Date.now()}@barrioshop.demo`;
  const storeName = `Tienda T1 ${Date.now()}`;

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Rosa Nueva");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /Acepto la política/ }).click();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // A new account is a client account (HU01): the header offers to register a
  // store, which is the documented path into the form.
  await expect(page).toHaveURL("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Registra tu tienda" })
    .click();
  await expect(page).toHaveURL("/panel/tienda");

  await page.getByLabel("Nombre de la tienda", { exact: true }).fill(storeName);
  await page.getByLabel("Tipo de comercio", { exact: true }).fill("Panadería");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Calle 40 Sur # 78-25");
  await page.getByLabel("Barrio", { exact: true }).fill("Castilla");
  await page.getByLabel("UPZ", { exact: true }).fill("Bavaria - Santa Rita");
  await page.getByLabel("WhatsApp", { exact: true }).fill("573001112233");
  await page
    .getByLabel("Horario de atención", { exact: true })
    .fill("Lun a Sáb 6:00-13:00");

  // HU02 CA2: the store needs the point the merchant marked; clicking the
  // Leaflet surface is what sets it.
  const map = page.locator(".leaflet-container").first();
  await expect(map).toBeVisible();
  await map.click();
  await expect(page.getByText(/Punto marcado/)).toBeVisible();

  await page.getByLabel("Foto de la tienda").setInputFiles(PHOTO);

  // Non-formalized merchant: the utility bill and the facade photo.
  await page.getByLabel("No está formalizado").check();
  await page.getByLabel("Recibo de servicio público").setInputFiles(PHOTO);
  await page
    .getByLabel("Foto de la fachada con la dirección visible")
    .setInputFiles(PHOTO);

  await page.getByRole("button", { name: "Guardar tienda" }).click();

  // HU09 CA2-CA3: the store starts under review and says so.
  await expect(page).toHaveURL("/panel");
  await expect(page.getByText(/En revisión/i).first()).toBeVisible();

  // And it is not in the public directory while it is not approved.
  await page.goto("/directorio");
  await expect(page.getByRole("link", { name: storeName })).toHaveCount(0);
});
