import { describe, expect, it } from "vitest";
import { storeTypeIcon } from "@/lib/store-type-icon";

describe("storeTypeIcon (mockup)", () => {
  it("gives each common comercio its own icon", () => {
    expect(storeTypeIcon("Panadería")).toBe("🥖");
    expect(storeTypeIcon("Fruver")).toBe("🍊");
    expect(storeTypeIcon("Miscelánea")).toBe("🧺");
    expect(storeTypeIcon("Droguería")).toBe("💊");
    expect(storeTypeIcon("Carnicería")).toBe("🥩");
  });

  it("reads the type without caring about case or accents", () => {
    expect(storeTypeIcon("  PANADERIA ")).toBe("🥖");
    expect(storeTypeIcon("panadería")).toBe("🥖");
  });

  it("matches a type that carries extra words", () => {
    expect(storeTypeIcon("Tienda de barrio")).toBe("🏪");
    expect(storeTypeIcon("Panadería y cafetería")).toBe("🥖");
  });

  it("falls back to the shop icon for anything it does not know", () => {
    expect(storeTypeIcon("Floristería")).toBe("🏪");
    expect(storeTypeIcon("")).toBe("🏪");
  });
});
