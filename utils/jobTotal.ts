/**
 * What a finished job cost.
 *
 * This has been wrong twice on the completed-job screen - first printing
 * ₦0.00 on a job whose own receipt read ₦40.00, then "Not available" on
 * the same job - so the arithmetic lives here, on its own, with tests.
 *
 * The order matters. The accepted quotation is the source the receipt
 * uses, so taking it first is what stops two screens one tap apart
 * disagreeing about a number somebody paid. The request record is only a
 * fallback, and an absent total is reported as absent rather than as free.
 */

/** Money arrives as a number, a numeric string, or a formatted one. */
export function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const n = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type QuotationLike = {
  total?: unknown;
  laborCost?: unknown;
  logisticsCost?: unknown;
  materials?: { unitPrice?: unknown; quantity?: unknown }[] | unknown;
} | null | undefined;

/**
 * A quotation's total: the figure it states, or its lines added up.
 *
 * Both, because `total` is not always populated on older quotations while
 * the line items always are - and adding the lines is exactly how the
 * receipt arrives at the figure it prints.
 */
export function quotationTotal(quotation: QuotationLike): number {
  if (!quotation) return 0;

  const stated = parseMoney(quotation.total);
  if (stated > 0) return stated;

  const materials = Array.isArray(quotation.materials)
    ? quotation.materials.reduce(
        (sum, item) => sum + parseMoney(item?.unitPrice) * parseMoney(item?.quantity),
        0,
      )
    : 0;

  return parseMoney(quotation.laborCost) + parseMoney(quotation.logisticsCost) + materials;
}

/** Keys the amount has been seen arriving under on the request record. */
const REQUEST_TOTAL_KEYS = [
  'totalCost',
  'total_amount',
  'paymentAmount',
  'amount',
  'amountDueOnArrival',
] as const;

/**
 * The job's total, or null when nothing has one.
 *
 * Null rather than zero, deliberately: zero is a claim about what somebody
 * paid, and it was a false one.
 */
export function resolveJobTotal(quotation: QuotationLike, request: unknown): number | null {
  const fromQuote = quotationTotal(quotation);
  if (fromQuote > 0) return fromQuote;

  const record = (request ?? {}) as Record<string, unknown>;
  for (const key of REQUEST_TOTAL_KEYS) {
    const value = parseMoney(record[key]);
    if (value > 0) return value;
  }
  return null;
}

/** Naira, two decimals, grouped - the format the receipt uses. */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
