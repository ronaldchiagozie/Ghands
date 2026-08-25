/**
 * Matching a wallet payment against its ledger row.
 *
 * Kept out of the screens so both the job-payment flow and the wallet checkout
 * read a settlement verdict the same way — and so the blank-reference case has
 * somewhere to be tested.
 */

type ReferencedRow = { reference?: unknown };

function normalizeReference(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * True only when the row carries the same non-empty reference as the payment.
 *
 * Both sides are normalized through `String(value ?? '')`, so a row with no
 * reference and a payment that came back without one would both collapse to
 * `''` and compare equal — reading an unrelated transaction as the verdict for
 * this payment. A blank on either side is never a match.
 */
export function matchesSettlementReference(row: ReferencedRow, reference: unknown): boolean {
  const target = normalizeReference(reference);
  if (!target) return false;
  const rowReference = normalizeReference(row?.reference);
  if (!rowReference) return false;
  return rowReference === target;
}

/** The ledger row raised by `reference`, or undefined when it has not landed yet. */
export function findSettlementRow<T extends ReferencedRow>(
  rows: readonly T[],
  reference: unknown,
): T | undefined {
  if (!normalizeReference(reference)) return undefined;
  return rows.find((row) => matchesSettlementReference(row, reference));
}

/**
 * A payment we cannot identify can never be polled to a verdict.
 * Narrows to `string` so callers can hand the reference straight to the poller.
 */
export function canPollForSettlement(reference: unknown): reference is string {
  return normalizeReference(reference).length > 0;
}
