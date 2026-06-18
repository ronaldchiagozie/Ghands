import type { Notification } from '@/services/api';

export type NotificationUserRole = 'client' | 'provider';

export type NotificationRoute = {
  pathname: string;
  params?: Record<string, string>;
};

const MESSAGE_TYPES = new Set([
  'message',
  'chat_new',
  'new_message',
  'chat_message',
  'text_message',
]);

const QUOTE_TYPES = new Set(['quotation_sent', 'quotation_accepted']);

const JOB_UPDATE_TYPES = new Set([
  'request_accepted',
  'work_order_issued',
  'work_order_created',
  'visit_request',
  'visit_scheduled',
  'inspection_scheduled',
  'job_started',
  'job_completed',
  'payment_required',
  'review_request',
]);

const PROVIDER_REQUEST_TYPES = new Set(['request_received', 'new_request']);

const WALLET_TYPES = new Set([
  'deposit_success',
  'withdrawal_success',
  'withdrawal_processed',
  'withdrawal_completed',
  'payment_released',
  'payout_released',
  'job_payment_released',
]);

export function normalizeNotificationType(type: unknown): string {
  return String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function parsePositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readMetaValue(meta: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

export function resolveNotificationRequestId(notification: Notification): number | null {
  const direct = parsePositiveInt(notification.requestId);
  if (direct != null) return direct;

  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : null;

  return parsePositiveInt(
    readMetaValue(meta, [
      'requestId',
      'request_id',
      'jobId',
      'job_id',
      'serviceRequestId',
      'service_request_id',
    ])
  );
}

function resolveProviderId(notification: Notification): number | null {
  const direct = parsePositiveInt(notification.providerId);
  if (direct != null) return direct;

  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : null;

  return parsePositiveInt(readMetaValue(meta, ['providerId', 'provider_id']));
}

function resolveProviderName(notification: Notification): string | undefined {
  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : null;

  const name = readMetaValue(meta, ['providerName', 'provider_name']);
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  return undefined;
}

function jobDetailsPath(userRole: NotificationUserRole): string {
  return userRole === 'provider' ? '/ProviderJobDetailsScreen' : '/OngoingJobDetails';
}

export function resolveNotificationRoute(
  notification: Notification,
  userRole: NotificationUserRole = 'client'
): NotificationRoute | null {
  const type = normalizeNotificationType(notification.type);
  const requestId = resolveNotificationRequestId(notification);
  const requestIdStr = requestId != null ? String(requestId) : null;

  if (WALLET_TYPES.has(type)) {
    return { pathname: '/WalletScreen' };
  }

  if (requestIdStr && MESSAGE_TYPES.has(type)) {
    const params: Record<string, string> = { requestId: requestIdStr };
    const providerId = resolveProviderId(notification);
    if (providerId != null) params.providerId = String(providerId);
    const providerName = resolveProviderName(notification);
    if (providerName) params.providerName = providerName;
    return { pathname: '/ChatScreen', params };
  }

  const detailsPath = jobDetailsPath(userRole);

  if (requestIdStr && QUOTE_TYPES.has(type)) {
    return {
      pathname: detailsPath,
      params: { requestId: requestIdStr, tab: 'quotations' },
    };
  }

  if (requestIdStr && (JOB_UPDATE_TYPES.has(type) || PROVIDER_REQUEST_TYPES.has(type))) {
    return {
      pathname: detailsPath,
      params: { requestId: requestIdStr, tab: 'updates' },
    };
  }

  if (requestIdStr) {
    return { pathname: detailsPath, params: { requestId: requestIdStr } };
  }

  return null;
}

export function canNavigateFromNotification(
  notification: Notification,
  userRole: NotificationUserRole = 'client'
): boolean {
  return resolveNotificationRoute(notification, userRole) != null;
}

export function notificationActionLabel(route: NotificationRoute | null): string {
  if (!route) return 'Close';
  if (route.pathname === '/ChatScreen') return 'Open chat';
  if (route.pathname === '/WalletScreen') return 'Open wallet';
  if (route.params?.tab === 'quotations') return 'View quote';
  return 'View job';
}

export function resolvePushNotificationRoute(
  data: Record<string, unknown>,
  userRole: NotificationUserRole = 'client'
): NotificationRoute | null {
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : null;

  const notification: Notification = {
    id: 0,
    userId: 0,
    type: String(data.type ?? ''),
    status: 'unread',
    title: '',
    message: '',
    requestId: parsePositiveInt(data.requestId) ?? undefined,
    providerId: parsePositiveInt(data.providerId) ?? undefined,
    metadata: meta,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return resolveNotificationRoute(notification, userRole);
}
