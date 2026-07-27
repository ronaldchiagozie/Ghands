import { summarizeForLog } from '@/utils/logSanitize';

/** Dev-only Metro logs — never shown in the app UI. */
function writeDevLog(entry: {
  event: string;
  detail?: string;
  reference?: string;
  transactionId?: string;
  responseSummary?: string;
}): void {
  if (!__DEV__) return;

  console.log(`[WalletActivity] ${entry.event}`, {
    detail: entry.detail,
    reference: entry.reference,
    transactionId: entry.transactionId,
  });

  if (entry.responseSummary) {
    try {
      console.log('[WalletActivity] response', JSON.parse(entry.responseSummary));
    } catch {
      console.log('[WalletActivity] response', entry.responseSummary);
    }
  }
}

export async function appendPaymentFlowLog(entry: {
  event: string;
  detail?: string;
  reference?: string;
  transactionId?: string;
  responseSummary?: string;
}): Promise<void> {
  writeDevLog(entry);
}

/** Log sanitized API response bodies from wallet/payment endpoints */
export async function logWalletApiResponse(
  event: string,
  context: { reference?: string; transactionId?: string; detail?: string },
  response: unknown,
): Promise<void> {
  writeDevLog({
    event,
    detail: context.detail,
    reference: context.reference,
    transactionId: context.transactionId,
    responseSummary: summarizeForLog(response),
  });
}

export async function logWalletApiError(
  event: string,
  context: { reference?: string; transactionId?: string; detail?: string },
  error: unknown,
): Promise<void> {
  const err = error as { message?: string; status?: number; response?: unknown };
  writeDevLog({
    event,
    detail: context.detail ?? err?.message ?? 'Request failed',
    reference: context.reference,
    transactionId: context.transactionId,
    responseSummary: summarizeForLog({
      status: err?.status,
      message: err?.message,
      body: err?.response,
    }),
  });
}

export async function logActivityTap(
  screen: 'Activity' | 'Wallet',
  action: string,
  transaction: {
    id: string;
    status: string;
    amount: number;
    reference?: string;
    serviceName?: string;
  },
): Promise<void> {
  writeDevLog({
    event: `${screen}: ${action}`,
    transactionId: transaction.id,
    reference: transaction.reference,
    detail: `${transaction.serviceName ?? 'Transaction'} · ${transaction.status} · ₦${transaction.amount}`,
    responseSummary: summarizeForLog(transaction),
  });
}

/** Top-up / Kora deposit flow — same Metro channel, easy to filter. */
export async function logWalletDeposit(event: string, context: {
  reference?: string;
  detail?: string;
  response?: unknown;
}): Promise<void> {
  writeDevLog({
    event: `[Deposit] ${event}`,
    reference: context.reference,
    detail: context.detail,
    responseSummary: context.response != null ? summarizeForLog(context.response) : undefined,
  });
}
