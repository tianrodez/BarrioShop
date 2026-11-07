import { expect, type Page } from "@playwright/test";
import { join } from "node:path";

/** The demo accounts seeded by `supabase/tests/900_demo_users.sql`. */
export const PASSWORD = "BarrioShop2026!";
export const DEMO = {
  panadera: "panadera@barrioshop.demo",
  fruver: "fruver@barrioshop.demo",
  vecina: "vecina@barrioshop.demo",
  /** The seeded administrator (HU09 CA4); not advertised on /login. */
  admin: "admin@barrioshop.demo",
};

export const PHOTO = join(process.cwd(), "e2e/fixtures/photo.png");

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  // A merchant lands on /panel, a client on the home page.
  await expect(page).toHaveURL(/\/(panel)?$/);
}

/** The public id of a seeded store, taken from the directory link. */
export async function storeIdFromDirectory(
  page: Page,
  name: string,
): Promise<string> {
  await page.goto("/directorio");
  await page.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/tienda\/[0-9a-f-]{36}/);
  const id = page.url().split("/tienda/")[1];
  if (!id) throw new Error(`could not read the store id from ${page.url()}`);
  return id;
}

export async function createProduct(
  page: Page,
  product: { name: string; price: string; category: string },
) {
  await page.goto("/panel/productos");
  await page.getByLabel("Nombre del producto").fill(product.name);
  await page.getByLabel("Categoría").fill(product.category);
  await page.getByLabel("Precio").fill(product.price);
  await page.getByLabel("Foto del producto").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText(product.name).first()).toBeVisible();
}

/** Distance label a card shows, normalised to metres for ordering checks. */
export function distanceInMetres(label: string): number | null {
  const short = label.match(/menos de 100 m/);
  if (short) return 50;

  const metres = label.match(/a\s+([\d.]+)\s+m/);
  if (metres) return Number(metres[1].replace(/\./g, ""));

  const kilometres = label.match(/a\s+([\d,]+)\s+km/);
  if (kilometres) return Number(kilometres[1].replace(",", ".")) * 1000;

  return null;
}
