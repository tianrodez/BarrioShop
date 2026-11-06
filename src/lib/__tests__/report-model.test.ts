import { describe, expect, it } from "vitest";
import {
  buildReportRow,
  REPORT_REASON_MAX_LENGTH,
  REPORT_REASON_MIN_LENGTH,
  reportTargetLabel,
  validateReportReason,
} from "@/lib/report-model";

describe("validateReportReason (HU11 CA1)", () => {
  it("asks for a reason long enough to describe the problem", () => {
    expect(validateReportReason("")).toMatch(/cuéntanos/i);
    expect(validateReportReason("     ")).toMatch(/cuéntanos/i);
    expect(validateReportReason("fals")).toMatch(/5 caracteres/i);
  });

  it("accepts a reason at each boundary the database accepts", () => {
    expect(
      validateReportReason("a".repeat(REPORT_REASON_MIN_LENGTH)),
    ).toBeNull();
    expect(
      validateReportReason("a".repeat(REPORT_REASON_MAX_LENGTH)),
    ).toBeNull();
  });

  it("rejects a reason longer than the column allows", () => {
    expect(
      validateReportReason("a".repeat(REPORT_REASON_MAX_LENGTH + 1)),
    ).toMatch(/1000 caracteres/i);
  });

  it("measures the reason without its surrounding spaces", () => {
    expect(validateReportReason("   dice que vende oro   ")).toBeNull();
  });
});

describe("buildReportRow (HU11 CA1)", () => {
  it("reports a store with the store column and no product", () => {
    expect(
      buildReportRow({
        target: "store",
        targetId: "store-1",
        reason: "  La dirección no existe  ",
        reporterId: "user-1",
      }),
    ).toEqual({
      reporter_id: "user-1",
      target: "store",
      store_id: "store-1",
      product_id: null,
      reason: "La dirección no existe",
    });
  });

  it("reports a product with the product column and no store", () => {
    expect(
      buildReportRow({
        target: "product",
        targetId: "product-1",
        reason: "El precio que muestra es falso",
        reporterId: "user-2",
      }),
    ).toEqual({
      reporter_id: "user-2",
      target: "product",
      store_id: null,
      product_id: "product-1",
      reason: "El precio que muestra es falso",
    });
  });
});

describe("reportTargetLabel", () => {
  it("names the thing the client is reporting", () => {
    expect(reportTargetLabel("store")).toBe("tienda");
    expect(reportTargetLabel("product")).toBe("producto");
  });
});
