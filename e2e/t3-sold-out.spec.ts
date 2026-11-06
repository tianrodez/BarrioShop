import { expect, test } from "@playwright/test";
import { createProduct, DEMO, login, storeIdFromDirectory } from "./helpers";

/**
 * T3 (formulación §13): a merchant marks a product as agotado in under a
 * minute, and the public catalog immediately stops offering it.
 */
test("T3: a merchant marks a product as agotado and the catalog obeys", async ({
  page,
}) => {
  const productName = `Agotado T3 ${Date.now()}`;

  await login(page, DEMO.panadera);
  await createProduct(page, {
    name: productName,
    price: "3000",
    category: "Panadería",
  });

  await page.getByRole("button", { name: `Editar ${productName}` }).click();
  await page.getByLabel("Estado").selectOption("sold_out");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  // Reload so the assertion reads what the server stored, not the optimistic
  // row: the public page must see the committed status.
  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: productName });
  await expect(row.getByText("Agotado", { exact: true })).toBeVisible();

  const storeId = await storeIdFromDirectory(page, "Panadería La Espiga");
  await page.goto(`/tienda/${storeId}`);

  const card = page.getByRole("group", { name: productName });
  await expect(card.getByText("Agotado", { exact: true })).toBeVisible();
  // HU06 CA1: an agotado product offers no way into the order.
  await expect(
    card.getByRole("button", { name: `Agregar ${productName} al pedido` }),
  ).toHaveCount(0);
});
