import { describe, expect, it } from "vitest";
import { parseStoreFields, storeFormSchema } from "@/lib/store-form-schema";
import type { StoreFormFields } from "@/lib/store-form-model";

function validFields(
  overrides: Partial<StoreFormFields> = {},
): StoreFormFields {
  return {
    name: "Panadería La Espiga",
    storeType: "Panadería",
    address: "Cra 72 #15-20",
    barrio: "Castilla",
    upz: "Castilla",
    referencePlace: "",
    whatsapp: "573001112233",
    openingHours: "Lun a Sáb 6:00-13:00",
    ...overrides,
  };
}

describe("storeFormSchema", () => {
  it("accepts the profile a merchant can fill without help (HU02)", () => {
    const result = parseStoreFields(validFields());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.fields.name).toBe("Panadería La Espiga");
      expect(result.fields.whatsapp).toBe("573001112233");
    }
  });

  it("trims the values so the database never stores padding", () => {
    const result = parseStoreFields(
      validFields({ name: "  La Tiendita  ", barrio: "  Castilla " }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.fields.name).toBe("La Tiendita");
      expect(result.fields.barrio).toBe("Castilla");
    }
  });

  it("points at the field that failed instead of a generic sentence", () => {
    const result = parseStoreFields(validFields({ name: "a", upz: "" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toMatch(/mínimo 2/);
      expect(result.errors.upz).toMatch(/UPZ/);
      expect(result.firstMessage).toMatch(/mínimo 2/);
    }
  });

  it("asks for a WhatsApp with country code and digits (HU02 CA1)", () => {
    const result = parseStoreFields(validFields({ whatsapp: "abc" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.whatsapp).toMatch(/indicativo de país/);
    }
  });

  it("accepts the separators a merchant actually types in a phone", () => {
    for (const whatsapp of [
      "+57 300 111 2233",
      "57-300-111-2233",
      "(57) 3001112233",
    ]) {
      expect(storeFormSchema.safeParse(validFields({ whatsapp })).success).toBe(
        true,
      );
    }
  });

  it("leaves the optional reference empty without failing", () => {
    expect(
      storeFormSchema.safeParse(validFields({ referencePlace: "" })).success,
    ).toBe(true);
  });
});
