/**
 * Formats an amount in Colombian pesos, e.g. 23600 -> "$23.600".
 *
 * Used by product prices (HU03) and order totals (HU06). COP has no
 * decimal subunit in practice, so fractional amounts are rounded.
 */
export function formatCOP(amount: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(amount)}`;
}
