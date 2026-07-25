import {
  formatMessageNotificationCopy,
  isMessageNotificationFromCurrentUser,
  isMessageNotificationType,
  mergeMessageNotificationMetadata,
  shouldShowMessageNotification,
} from '@/utils/messageNotificationCopy';

describe('messageNotificationCopy', () => {
  it('does not show notification when client sent (senderType user)', () => {
    expect(
      shouldShowMessageNotification({
        userRole: 'client',
        currentUserId: 9,
        notificationProviderId: 100,
        metadata: { senderType: 'user', senderId: 9 },
        bodyText: 'Provider sent you a message',
      }),
    ).toBe(false);
  });

  it('does not show echo when client sent but backend uses provider template without senderId', () => {
    expect(
      shouldShowMessageNotification({
        userRole: 'client',
        currentUserId: 9,
        notificationProviderId: 100,
        metadata: { senderType: 'provider' },
        bodyText: 'Provider sent you a message',
      }),
    ).toBe(false);
  });

  it('shows when provider sent (senderId matches job provider)', () => {
    expect(
      shouldShowMessageNotification({
        userRole: 'client',
        currentUserId: 9,
        notificationProviderId: 100,
        metadata: { senderId: 100, senderType: 'provider' },
        bodyText: 'Provider sent you a message',
      }),
    ).toBe(true);
  });

  it('treats client send as self when senderId is not the job provider', () => {
    expect(
      isMessageNotificationFromCurrentUser({
        userRole: 'client',
        currentUserId: 9,
        notificationProviderId: 100,
        metadata: { senderId: 9 },
      }),
    ).toBe(true);
  });

  it('formats inbound provider message with provider name', () => {
    const result = formatMessageNotificationCopy('Provider sent you a message', {
      userRole: 'client',
      metadata: { providerName: 'Ace Repairs', senderType: 'provider', senderId: 100 },
    });
    expect(result).toBe('Ace Repairs sent you a message');
  });

  it('formats inbound provider message without name', () => {
    const result = formatMessageNotificationCopy('Provider sent you a message', {
      userRole: 'client',
      metadata: { senderType: 'provider', senderId: 100 },
    });
    expect(result).toBe('Your provider sent you a message');
  });

  it('detects provider-side self send', () => {
    expect(
      isMessageNotificationFromCurrentUser({
        userRole: 'provider',
        metadata: { senderType: 'provider', direction: 'outgoing' },
      }),
    ).toBe(true);
  });

  it('recognizes chat_new as message notification type', () => {
    expect(isMessageNotificationType('chat_new')).toBe(true);
  });

  it('merges flat push data for sender detection', () => {
    const merged = mergeMessageNotificationMetadata({
      type: 'message',
      senderId: 7,
      senderType: 'user',
      providerId: 100,
    });
    expect(
      shouldShowMessageNotification({
        userRole: 'client',
        currentUserId: 7,
        notificationProviderId: 100,
        metadata: merged,
        bodyText: 'Provider sent you a message',
      }),
    ).toBe(false);
  });
});
