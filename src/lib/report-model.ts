/**
 * Report model (HU11).
 *
 * A client or a merchant reports a store or a product whose information looks
 * false (HU11 CA1). The row that reaches `store_reports` has to mirror the
 * column contract exactly: `target` is exhaustive with its id (the table's
 * CHECK refuses both columns at once), and the reason length is the one the
 * column accepts.
 */

export type ReportTarget = "store" | "product";

export const REPORT_REASON_MIN_LENGTH = 5;
export const REPORT_REASON_MAX_LENGTH = 1000;

export type ReportRow = {
  reporter_id: string;
  target: ReportTarget;
  store_id: string | null;
  product_id: string | null;
  reason: string;
};

/** Null when the reason is usable, otherwise the sentence the client reads. */
export function validateReportReason(reason: string): string | null {
  const trimmed = reason.trim();

  if (!trimmed) {
    return "Cuéntanos qué información es falsa o engañosa.";
  }
  if (trimmed.length < REPORT_REASON_MIN_LENGTH) {
    return `Escribe al menos ${REPORT_REASON_MIN_LENGTH} caracteres para que podamos revisarlo.`;
  }
  if (trimmed.length > REPORT_REASON_MAX_LENGTH) {
    return `El motivo no puede pasar de ${REPORT_REASON_MAX_LENGTH} caracteres.`;
  }

  return null;
}

/**
 * HU11 CA1: store reports and product reports live in the same table, and the
 * exclusivity CHECK makes the wrong shape fail at the database too.
 */
export function buildReportRow(args: {
  target: ReportTarget;
  targetId: string;
  reason: string;
  reporterId: string;
}): ReportRow {
  return {
    reporter_id: args.reporterId,
    target: args.target,
    store_id: args.target === "store" ? args.targetId : null,
    product_id: args.target === "product" ? args.targetId : null,
    reason: args.reason.trim(),
  };
}

export function reportTargetLabel(target: ReportTarget): string {
  return target === "store" ? "tienda" : "producto";
}
