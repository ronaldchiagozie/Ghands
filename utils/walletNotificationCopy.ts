import type { Notification } from '@/services/api';
import {
  extractWalletTransactionFailureReason,
  mapWalletTransactionStatus,
  type WalletTransactionRow,
} from '@/utils/walletTransactions';
import { normalizeNotificationType } from '@/utils/notificationNavigation';

export type WalletNotificationContext = {
  transactionById?: ReadonlyMap<number, WalletTransactionRow>;
};

export type WalletNotificationCategory = 'deposit' | 'withdrawal' | 'payment';

export type WalletNotificationPresentation = {
  typeLabel: string;
  description: string;
  tone: 'success' | 'warning' | 'error' | 'neutral';
};

function readMeta(meta: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

function parseAmount(notification: Notification): number | null {
  const meta = notification.metadata;
  const raw = readMeta(meta, ['amount', 'total', 'transactionAmount', 'paidAmount']);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

export function resolveWalletNotificationCategory(
  notification: Notification,
): WalletNotificationCategory | null {
  const type = normalizeNotificationType(notification.type);
  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? notification.metadata
      : null;
  const metaType = normalizeNotificationType(
    readMeta(meta, ['transactionType', 'walletTransactionType', 'type']),
  );

  if (type.includes('deposit') || metaType === 'deposit') return 'deposit';
  if (type.includes('withdrawal') || metaType === 'withdrawal') return 'withdrawal';
  if (
    (type.includes('payment') || metaType === 'payment') &&
    !type.includes('released') &&
    !type.includes('required') &&
    !type.includes('payout')
  ) {
    return 'payment';
  }

  if (notification.transactionId != null && metaType === 'deposit') return 'deposit';
  return null;
}

function parseTransactionId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Deposit / withdraw / wallet payment — open ledger receipt, not job quote. */
export function shouldOpenWalletTransactionReceipt(notification: Notification): boolean {
  const type = normalizeNotificationType(notification.type);
  if (type.includes('released') || type.includes('payout')) return false;
  if (parseTransactionId(notification.transactionId) == null) return false;
  return resolveWalletNotificationCategory(notification) != null;
}

function explicitWalletStatusFromMeta(
  meta: Record<string, unknown> | null,
): 'completed' | 'pending' | 'failed' | null {
  if (!meta) return null;
  const statusRaw = readMeta(meta, ['status', 'transactionStatus', 'paymentStatus']);
  const completedAt = meta.completedAt;
  if (statusRaw == null && (completedAt == null || completedAt === '')) {
    return null;
  }
  return mapWalletTransactionStatus({
    status: statusRaw != null ? String(statusRaw) : undefined,
    paymentStatus: meta.paymentStatus as string | undefined,
    transactionStatus: meta.transactionStatus as string | undefined,
    completedAt: completedAt as string | null | undefined,
    type: String(meta.transactionType ?? meta.walletTransactionType ?? ''),
  });
}

/** Truthful status — ledger row wins, then metadata, then notification type. */
export function resolveWalletNotificationStatus(
  notification: Notification,
  context?: WalletNotificationContext,
): 'completed' | 'pending' | 'failed' | null {
  const type = normalizeNotificationType(notification.type);
  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : null;

  const txId = parseTransactionId(notification.transactionId);
  if (txId != null && context?.transactionById?.has(txId)) {
    return mapWalletTransactionStatus(context.transactionById.get(txId)!);
  }

  const fromMeta = explicitWalletStatusFromMeta(meta);

  if (type.includes('failed') || type.includes('failure') || type.includes('declined')) {
    return 'failed';
  }
  if (type.includes('pending') || type.includes('processing')) {
    return fromMeta === 'failed' ? 'failed' : 'pending';
  }
  if (type.includes('success') || type.includes('completed')) {
    if (fromMeta === 'failed') return 'failed';
    if (fromMeta === 'pending') return 'pending';
    return 'completed';
  }

  return fromMeta;
}

export function walletNotificationPresentation(
  notification: Notification,
  fallbackDescription: string,
  context?: WalletNotificationContext,
): WalletNotificationPresentation | null {
  const category = resolveWalletNotificationCategory(notification);
  if (!category) return null;

  const status = resolveWalletNotificationStatus(notification, context);
  if (!status) return null;

  const amountText = formatAmount(parseAmount(notification));
  const txId = parseTransactionId(notification.transactionId);
  const ledgerTx =
    txId != null && context?.transactionById?.has(txId)
      ? context.transactionById.get(txId)
      : undefined;
  const failureReason = ledgerTx
    ? extractWalletTransactionFailureReason(ledgerTx)
    : notification.metadata
      ? extractWalletTransactionFailureReason(notification.metadata as WalletTransactionRow)
      : undefined;

  if (category === 'deposit') {
    if (status === 'failed') {
      return {
        typeLabel: 'Deposit failed',
        description:
          fallbackDescription && /fail|declin|could not|unable/i.test(fallbackDescription)
            ? fallbackDescription
            : amountText
              ? `${amountText} was not added to your wallet. ${failureReason || 'Payment could not be confirmed.'}`
              : failureReason || 'Your wallet deposit could not be completed.',
        tone: 'error',
      };
    }
    if (status === 'pending') {
      return {
        typeLabel: 'Deposit pending',
        description:
          fallbackDescription ||
          (amountText
            ? `We're still confirming ${amountText}. Your balance will update when the payment clears.`
            : 'Your deposit is still being confirmed.'),
        tone: 'warning',
      };
    }
    return {
      typeLabel: 'Deposit successful',
      description:
        fallbackDescription ||
        (amountText
          ? `${amountText} was added to your wallet.`
          : 'Your deposit was added to your wallet balance.'),
      tone: 'success',
    };
  }

  if (category === 'withdrawal') {
    if (status === 'failed') {
      return {
        typeLabel: 'Withdrawal failed',
        description:
          fallbackDescription && /fail|declin|could not/i.test(fallbackDescription)
            ? fallbackDescription
            : amountText
              ? `Your withdrawal of ${amountText} could not be completed.`
              : 'Your withdrawal could not be completed.',
        tone: 'error',
      };
    }
    if (status === 'pending') {
      return {
        typeLabel: 'Withdrawal pending',
        description:
          fallbackDescription ||
          (amountText
            ? `Your withdrawal of ${amountText} is being processed.`
            : 'Your withdrawal is being processed.'),
        tone: 'warning',
      };
    }
    return {
      typeLabel: 'Withdrawal successful',
      description:
        fallbackDescription ||
        (amountText
          ? `Your withdrawal of ${amountText} was processed.`
          : 'Your withdrawal was processed.'),
      tone: 'success',
    };
  }

  // wallet service payment
  if (status === 'failed') {
    return {
      typeLabel: 'Payment failed',
      description:
        fallbackDescription && /fail|declin|could not/i.test(fallbackDescription)
          ? fallbackDescription
          : amountText
            ? `Payment of ${amountText} did not complete.`
            : failureReason || 'Your wallet payment did not complete.',
      tone: 'error',
    };
  }
  if (status === 'pending') {
    return {
      typeLabel: 'Payment pending',
      description: fallbackDescription || 'Your payment is still being confirmed.',
      tone: 'warning',
    };
  }
  return {
    typeLabel: 'Payment successful',
    description:
      fallbackDescription ||
      (amountText ? `Payment of ${amountText} was completed.` : 'Your payment was completed.'),
    tone: 'success',
  };
}
