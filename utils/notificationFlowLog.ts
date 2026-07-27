import type { Notification } from '@/services/api';
import { summarizeForLog } from '@/utils/logSanitize';
import {
  resolveWalletNotificationCategory,
  resolveWalletNotificationStatus,
  walletNotificationPresentation,
  type WalletNotificationContext,
} from '@/utils/walletNotificationCopy';

/** Dev-only Metro logs — filter terminal with `[Notifications]`. */
function writeLog(event: string, context?: Record<string, unknown>, response?: unknown): void {
  if (!__DEV__) return;
  console.log(`[Notifications] ${event}`, context ?? {});
  if (response !== undefined) {
    try {
      const parsed = JSON.parse(summarizeForLog(response));
      console.log('[Notifications] response', parsed);
    } catch {
      console.log('[Notifications] response', summarizeForLog(response));
    }
  }
}

function summarizeNotificationRows(notifications: Notification[]): unknown[] {
  return notifications.slice(0, 40).map((n) => {
    const meta =
      n.metadata && typeof n.metadata === 'object'
        ? (n.metadata as Record<string, unknown>)
        : null;
    return {
      id: n.id,
      type: n.type,
      read: n.status,
      title: n.title,
      message:
        typeof n.message === 'string' && n.message.length > 140
          ? `${n.message.slice(0, 140)}…`
          : n.message,
      description:
        typeof n.description === 'string' && n.description.length > 140
          ? `${n.description.slice(0, 140)}…`
          : n.description,
      transactionId: n.transactionId,
      requestId: n.requestId,
      metadata: meta
        ? {
            status: meta.status,
            transactionStatus: meta.transactionStatus,
            paymentStatus: meta.paymentStatus,
            transactionType: meta.transactionType ?? meta.type,
            amount: meta.amount,
            completedAt: meta.completedAt,
          }
        : null,
    };
  });
}

function summarizeWalletUiMapping(
  notifications: Notification[],
  context?: WalletNotificationContext,
): unknown[] {
  return notifications
    .map((n) => {
      const category = resolveWalletNotificationCategory(n);
      if (!category) return null;
      const resolvedStatus = resolveWalletNotificationStatus(n, context);
      const fallback = String(n.description || n.message || '').trim();
      const ui = walletNotificationPresentation(n, fallback, context);
      return {
        id: n.id,
        apiType: n.type,
        transactionId: n.transactionId,
        category,
        resolvedStatus,
        uiLabel: ui?.typeLabel,
        uiTone: ui?.tone,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export function logNotificationsListApi(
  detail: string,
  result: { total: number; limit: number; offset: number; notifications: Notification[] },
  context?: WalletNotificationContext,
): void {
  writeLog('API GET /api/notifications', {
    detail,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    count: result.notifications.length,
  });
  writeLog('notification rows (from API)', undefined, summarizeNotificationRows(result.notifications));

  const walletMapping = summarizeWalletUiMapping(result.notifications, context);
  if (walletMapping.length > 0) {
    writeLog('wallet notification UI mapping', { count: walletMapping.length }, walletMapping);
  }
}

export function logNotificationsApiError(detail: string, error: unknown): void {
  if (!__DEV__) return;
  const err = error as { message?: string; status?: number };
  writeLog('API GET /api/notifications (error)', {
    detail,
    message: err?.message,
    status: err?.status,
  });
}
