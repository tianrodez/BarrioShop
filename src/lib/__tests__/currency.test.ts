import { describe, expect, it } from "vitest";
import { formatCOP } from "@/lib/currency";

// HU03/HU06: product prices and order totals are shown in Colombian pesos,
// with the currency prefix and thousands separators (e.g. "$23.600").
describe("formatCOP", () => {
  it("formats whole pesos with thousands separators", () => {
    expect(formatCOP(23600)).toBe("$23.600");
  });

  it("formats zero", () => {
    expect(formatCOP(0)).toBe("$0");
  });

  it("rounds fractional amounts to whole pesos", () => {
    expect(formatCOP(1250.6)).toBe("$1.251");
  });

  it("handles large amounts", () => {
    expect(formatCOP(8135600)).toBe("$8.135.600");
  });
});
