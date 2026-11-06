import { describe, expect, it } from "vitest";
import { parseProductFields } from "@/lib/product-form-schema";

const valid = {
  name: "Pan campesino 500 g",
  category: "Panadería",
  description: "Masa madre.",
  price: "4000",
  status: "available",
};

describe("productFormSchema", () => {
  it("accepts the catalog row the merchant publishes (HU03)", () => {
    const result = parseProductFields(valid);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.values.price).toBe(4000);
      expect(result.values.status).toBe("available");
    }
  });

  it("rejects a price that is not a whole number of pesos", () => {
    for (const price of ["", "abc", "0", "-10", "1200.5"]) {
      const result = parseProductFields({ ...valid, price });
      expect(result.success, price).toBe(false);
      if (!result.success) expect(result.errors.price).toBeTruthy();
    }
  });

  it("keeps the availability inside the two documented states", () => {
    const result = parseProductFields({ ...valid, status: "paused" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.status).toMatch(/disponibilidad/);
    }
  });

  it("points at the name when it is too short", () => {
    const result = parseProductFields({ ...valid, name: "x" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toMatch(/mínimo 2/);
  });
});
