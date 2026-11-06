import { describe, expect, it } from "vitest";
import { formatProductPriceUpdatedAt } from "@/lib/product-catalog-model";

describe("product catalog model", () => {
  it("formats the price change date for the visible notice", () => {
    expect(formatProductPriceUpdatedAt("2026-11-04T12:00:00.000Z")).toContain(
      "2026",
    );
  });

  it("preserves an invalid timestamp rather than hiding the notice", () => {
    expect(formatProductPriceUpdatedAt("fecha inválida")).toBe(
      "fecha inválida",
    );
  });
});
