/** Raw wallet transaction row from GET /api/wallet/transactions */
export type WalletTransactionRow = {
  id?: number | string;
  reference?: string;
  type?: string;
  status?: string;
  /** The API varies which field carries the verdict; all three are read. */
  paymentStatus?: string;
  transactionStatus?: string;
  amount?: number;
  description?: string;
  createdAt?: string;
  completedAt?: string | null;
  requestId?: number | null;
};

/** Abandoned checkouts — not real payment failures. */
export function isCancelledWalletTransaction(tx: WalletTransactionRow): boolean {
  const status = String(tx.status ?? '').toLowerCase();
  return status === 'cancelled' || status === 'canceled';
}

export function extractWalletTransactionFailureReason(tx: WalletTransactionRow): string | undefined {
  const extra = tx as Record<string, unknown>;
  const fields = [
    extra.failureReason,
    extra.failureMessage,
    extra.reason,
    extra.errorMessage,
    extra.statusMessage,
    extra.message,
    extra.note,
  ];
  for (const raw of fields) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (lower === 'failed' || lower === 'cancelled' || lower === 'canceled') continue;
    return s;
  }
  const status = String(tx.status ?? '').toLowerCase();
  const desc = String(tx.description ?? '').trim();
  if (status === 'failed' && desc) {
    const lower = desc.toLowerCase();
    if (!lower.includes('funds added to wallet') && lower !== 'wallet deposit') {
      return desc;
    }
  }
  if (status === 'failed' && String(extra.type ?? '').toLowerCase() === 'deposit') {
    return 'Payment verification did not complete.';
  }
  return undefined;
}

export function walletTransactionTimestamp(tx: WalletTransactionRow): string {
  const extra = tx as Record<string, unknown>;
  const raw =
    tx.completedAt ??
    tx.createdAt ??
    extra.updatedAt ??
    extra.initiatedAt;
  return raw ? String(raw) : new Date().toISOString();
}

export function mapWalletTransactionStatus(
  tx: WalletTransactionRow,
): 'completed' | 'pending' | 'failed' {
  /**
   * Callers already pass `paymentStatus` / `transactionStatus` alongside `status`
   * — they were silently ignored here, so a row carrying only one of the aliases
   * read as `pending` no matter what it actually said. First non-empty wins, so a
   * present `status` still takes precedence.
   */
  const status = [tx.status, tx.paymentStatus, tx.transactionStatus]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .find((value) => value !== '') ?? '';
  if (
    status === 'completed' ||
    status === 'success' ||
    status === 'successful' ||
    status === 'paid' ||
    status === 'approved'
  ) {
    return 'completed';
  }
  if (status === 'failed' || status === 'declined') {
    return 'failed';
  }
  if (tx.completedAt) {
    return 'completed';
  }
  return 'pending';
}
