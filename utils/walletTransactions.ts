/** Raw wallet transaction row from GET /api/wallet/transactions */
export type WalletTransactionRow = {
  id?: number | string;
  reference?: string;
  type?: string;
  status?: string;
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

export function mapWalletTransactionStatus(
  tx: WalletTransactionRow,
): 'completed' | 'pending' | 'failed' {
  const status = String(tx.status ?? '').toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'pending';
}
