import { expect, test } from "@playwright/test";
import { createProduct, DEMO, login, storeIdFromDirectory } from "./helpers";

/**
 * T2 (formulación §13): a merchant uploads a product with name, price,
 * category and photo, and a neighbour sees it in the public catalog.
 */
test("T2: a merchant publishes a product with its photo", async ({ page }) => {
  const productName = `Pan T2 ${Date.now()}`;

  await login(page, DEMO.panadera);
  await createProduct(page, {
    name: productName,
    price: "4500",
    category: "Panadería",
  });

  const storeId = await storeIdFromDirectory(page, "Panadería La Espiga");
  await page.goto(`/tienda/${storeId}`);

  // Everything is asserted inside the product card: the photo the merchant
  // uploaded, its own price, and the order control.
  const card = page.getByRole("group", { name: productName });
  await expect(card).toBeVisible();
  await expect(card.getByText("$4.500")).toBeVisible();
  await expect(
    page.getByRole("img", { name: `Foto de ${productName}` }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: `Agregar ${productName} al pedido` }),
  ).toBeVisible();
});
