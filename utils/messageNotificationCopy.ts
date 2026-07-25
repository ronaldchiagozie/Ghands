import type { NotificationUserRole } from '@/utils/notificationNavigation';

export const MESSAGE_NOTIFICATION_TYPES = new Set([
  'message',
  'chat_new',
  'new_message',
  'chat_message',
  'text_message',
]);

export function isMessageNotificationType(type: unknown): boolean {
  const normalized = String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return MESSAGE_NOTIFICATION_TYPES.has(normalized);
}

function parsePositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readMeta(meta: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

export type MessageNotificationPerspective = {
  userRole: NotificationUserRole;
  currentUserId?: number | null;
  currentCompanyId?: number | null;
  metadata?: Record<string, unknown> | null;
  /** From notification row — job provider / company for peer matching (client view). */
  notificationProviderId?: number | null;
  notificationCompanyId?: number | null;
  bodyText?: string;
};

function senderTypeLower(meta: Record<string, unknown>): string {
  return String(readMeta(meta, ['senderType', 'sender_type', 'senderRole', 'sender_role']) ?? '')
    .trim()
    .toLowerCase();
}

function directionLower(meta: Record<string, unknown>): string {
  return String(readMeta(meta, ['direction', 'messageDirection', 'message_direction']) ?? '')
    .trim()
    .toLowerCase();
}

function senderIdFrom(meta: Record<string, unknown>): number | null {
  return parsePositiveInt(
    readMeta(meta, ['senderId', 'sender_id', 'fromUserId', 'from_user_id']),
  );
}

function peerProviderId(ctx: MessageNotificationPerspective): number | null {
  return (
    parsePositiveInt(ctx.notificationProviderId) ??
    parsePositiveInt(readMeta(ctx.metadata ?? {}, ['providerId', 'provider_id']))
  );
}

function peerCompanyId(ctx: MessageNotificationPerspective): number | null {
  return (
    parsePositiveInt(ctx.notificationCompanyId) ??
    parsePositiveInt(readMeta(ctx.metadata ?? {}, ['companyId', 'company_id']))
  );
}

/** True when the notification describes a message the current user sent (not received). */
export function isMessageNotificationFromCurrentUser(input: MessageNotificationPerspective): boolean {
  const meta = input.metadata ?? {};
  const senderType = senderTypeLower(meta);
  const direction = directionLower(meta);

  if (direction === 'outgoing' || direction === 'outbound' || direction === 'sent') return true;
  if (meta.isOutgoing === true || meta.is_outgoing === true) return true;
  if (meta.fromSelf === true || meta.isFromSender === true || meta.sentBySelf === true) return true;

  const senderId = senderIdFrom(meta);
  if (input.userRole === 'client' && input.currentUserId != null && senderId === input.currentUserId) {
    return true;
  }
  if (input.userRole === 'provider' && input.currentCompanyId != null && senderId === input.currentCompanyId) {
    return true;
  }
  if (input.userRole === 'provider' && input.currentUserId != null && senderId === input.currentUserId) {
    return true;
  }

  if (input.userRole === 'client' && ['user', 'client', 'customer'].includes(senderType)) {
    return true;
  }
  if (input.userRole === 'provider' && ['provider', 'company'].includes(senderType)) {
    return true;
  }

  // Same rule as chat bubbles: on client, anyone who isn't the job provider is "you".
  if (input.userRole === 'client') {
    const providerId = peerProviderId(input);
    const companyId = peerCompanyId(input);
    if (senderId != null && providerId != null && senderId !== providerId) {
      if (companyId == null || senderId !== companyId) {
        return true;
      }
    }
  }

  return false;
}

const INBOUND_PROVIDER_MESSAGE = /provider\s+sent\s+you\s+(a\s+)?(text|message)/i;
const INBOUND_CLIENT_MESSAGE = /client\s+sent\s+you\s+(a\s+)?(text|message)/i;

/** Flatten push `data` + nested `metadata` for sender detection. */
export function mergeMessageNotificationMetadata(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!data) return {};
  const nested = data.metadata;
  const base =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : {};
  return {
    ...base,
    senderType:
      readMeta(base, ['senderType', 'sender_type']) ??
      readMeta(data, ['senderType', 'sender_type']),
    senderId:
      readMeta(base, ['senderId', 'sender_id']) ?? readMeta(data, ['senderId', 'sender_id']),
    direction: readMeta(base, ['direction']) ?? readMeta(data, ['direction']),
    providerId:
      readMeta(base, ['providerId', 'provider_id']) ?? readMeta(data, ['providerId', 'provider_id']),
    companyId:
      readMeta(base, ['companyId', 'company_id']) ?? readMeta(data, ['companyId', 'company_id']),
  };
}

function isFromProviderSender(ctx: MessageNotificationPerspective): boolean {
  const meta = ctx.metadata ?? {};
  const senderType = senderTypeLower(meta);
  const senderId = senderIdFrom(meta);
  const providerId = peerProviderId(ctx);
  const companyId = peerCompanyId(ctx);

  if (senderId != null && ctx.currentUserId != null && senderId === ctx.currentUserId) {
    return false;
  }
  if (senderId != null && providerId != null && senderId === providerId) return true;
  if (senderId != null && companyId != null && senderId === companyId) return true;

  if (['provider', 'company'].includes(senderType) && senderId != null) {
    if (providerId != null && senderId === providerId) return true;
    if (companyId != null && senderId === companyId) return true;
  }

  return false;
}

function isFromClientSender(ctx: MessageNotificationPerspective): boolean {
  const meta = ctx.metadata ?? {};
  const senderType = senderTypeLower(meta);
  const senderId = senderIdFrom(meta);

  if (['user', 'client', 'customer'].includes(senderType)) {
    if (ctx.currentUserId != null && senderId === ctx.currentUserId) return false;
    if (ctx.currentCompanyId != null && senderId === ctx.currentCompanyId) return false;
    return true;
  }
  if (senderId != null && ctx.currentUserId != null && senderId === ctx.currentUserId) return true;
  const providerId = peerProviderId(ctx);
  const companyId = peerCompanyId(ctx);
  if (senderId != null && providerId != null && senderId === providerId) return false;
  if (senderId != null && companyId != null && senderId === companyId) return false;
  if (senderId != null) return true;
  return false;
}

/**
 * Message alerts only for messages from the other party — never for your own sends,
 * and not for ambiguous backend echoes (wrong template, missing sender).
 */
export function shouldShowMessageNotification(input: MessageNotificationPerspective): boolean {
  if (isMessageNotificationFromCurrentUser(input)) {
    return false;
  }

  const meta = input.metadata ?? {};
  const body = String(input.bodyText ?? '').trim();

  if (input.userRole === 'client') {
    if (isFromProviderSender(input)) {
      return true;
    }
    if (INBOUND_PROVIDER_MESSAGE.test(body) && senderIdFrom(meta) == null) {
      return false;
    }
    return false;
  }

  if (input.userRole === 'provider') {
    if (isFromClientSender(input)) {
      return true;
    }
    if (INBOUND_CLIENT_MESSAGE.test(body) && senderIdFrom(meta) == null) {
      return false;
    }
    return false;
  }

  return false;
}

/**
 * Copy for inbound message notifications only (caller should filter with shouldShowMessageNotification).
 */
export function formatMessageNotificationCopy(
  rawText: string,
  input: MessageNotificationPerspective,
): string {
  const text = String(rawText ?? '')
    .trim()
    .replace(/^null[\s:,-]*/i, '')
    .trim();
  if (!text) return '';

  const meta = input.metadata ?? {};
  const providerName = String(
    readMeta(meta, ['providerName', 'provider_name', 'companyName', 'company_name']) ?? '',
  ).trim();

  if (input.userRole === 'client') {
    if (providerName) {
      return `${providerName} sent you a message`;
    }
    if (INBOUND_PROVIDER_MESSAGE.test(text)) {
      return 'Your provider sent you a message';
    }
  }

  if (input.userRole === 'provider') {
    const clientName = String(readMeta(meta, ['clientName', 'client_name', 'userName', 'user_name']) ?? '').trim();
    if (clientName) {
      return `${clientName} sent you a message`;
    }
    if (INBOUND_CLIENT_MESSAGE.test(text)) {
      return 'Your client sent you a message';
    }
  }

  return text;
}

export function formatMessageNotificationTitle(
  rawTitle: string,
  input: MessageNotificationPerspective,
): string {
  const title = String(rawTitle ?? '').trim();
  if (INBOUND_PROVIDER_MESSAGE.test(title) || INBOUND_CLIENT_MESSAGE.test(title)) {
    return 'New message';
  }
  return title || 'New message';
}
