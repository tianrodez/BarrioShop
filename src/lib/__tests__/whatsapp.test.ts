import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

describe("buildWhatsAppUrl", () => {
  it("builds the wa.me link from the stored digits", () => {
    expect(buildWhatsAppUrl("573001112233")).toBe("https://wa.me/573001112233");
  });

  it("keeps a prefilled message url-safe", () => {
    expect(
      buildWhatsAppUrl(
        "573001112233",
        "Hola, ¿tienen aguacate? Precio: $3.200",
      ),
    ).toBe(
      "https://wa.me/573001112233?text=Hola%2C%20%C2%BFtienen%20aguacate%3F%20Precio%3A%20%243.200",
    );
  });

  it("strips anything that is not a digit before building the link", () => {
    expect(buildWhatsAppUrl("+57 (300) 111-2233")).toBe(
      "https://wa.me/573001112233",
    );
  });

  it("refuses a number that cannot be a WhatsApp contact", () => {
    expect(() => buildWhatsAppUrl("12345")).toThrow(/número de WhatsApp/);
    expect(() => buildWhatsAppUrl("")).toThrow(/número de WhatsApp/);
  });
});
