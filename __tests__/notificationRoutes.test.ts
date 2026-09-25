import type { Notification } from '@/services/api';
import { resolveNotificationRoute, resolvePushNotificationRoute } from '@/utils/notificationNavigation';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 1,
    userId: 1,
    type: 'new_message',
    status: 'unread',
    title: '',
    message: '',
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('where a customer notification opens', () => {
  it('opens the dispute chat for a dispute reply, not the job chat', () => {
    expect(
      resolveNotificationRoute(
        notification({ requestId: 42, metadata: { disputeId: 7, isDisputeMessage: true } }),
      ),
    ).toEqual({ pathname: '/DisputeChatScreen', params: { disputeId: '7' } });
  });

  it('still opens the job chat for an ordinary message', () => {
    expect(resolveNotificationRoute(notification({ requestId: 42 }))?.pathname).toBe('/ChatScreen');
  });

  it('routes a dispute reply push the same way', () => {
    expect(
      resolvePushNotificationRoute({ type: 'new_message', requestId: 42, metadata: { disputeId: '7' } }),
    ).toEqual({ pathname: '/DisputeChatScreen', params: { disputeId: '7' } });
  });
});
