import { expect, test } from "@playwright/test";

/**
 * T5 (formulación §13): a client filters the stores by category and opens the
 * contact of one of them (the wa.me deep link).
 */
test("T5: a client filters by category and opens the contact", async ({
  page,
}) => {
  await page.goto("/directorio");

  await page.getByLabel("Categoría").selectOption("Panadería");

  // Only the panadería remains, and it is the store the card links to.
  const storeLinks = page.locator('li a[href^="/tienda/"]');
  await expect(storeLinks).toHaveCount(1);
  await expect(storeLinks.first()).toHaveText("Panadería La Espiga");

  await storeLinks.first().click();
  await expect(page).toHaveURL(/\/tienda\/[0-9a-f-]{36}/);

  const contact = page.getByRole("link", { name: "Escribir por WhatsApp" });
  await expect(contact).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/573001112233/,
  );
  await expect(contact).toHaveAttribute("target", "_blank");

  // Opening it really launches the deep link, without leaving the test's
  // network to fetch WhatsApp itself.
  await page.route("https://wa.me/**", (route) => route.abort());
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    contact.click(),
  ]);
  // WhatsApp answers the deep link with its api host; the number is what
  // proves the contact opened.
  expect(popup.url()).toMatch(/(wa\.me|api\.whatsapp\.com)\/?[^]*573001112233/);
  await popup.close();
});
