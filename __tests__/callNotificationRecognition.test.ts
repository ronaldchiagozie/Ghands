import { isIncomingCallNotification, resolvePushNotificationRoute } from '@/utils/notificationNavigation';

/** What the server sends when a provider rings: a call, typed as a message. */
const incomingCallAsMessage = {
  type: 'new_message',
  requestId: 5,
  metadata: { callId: 1, callerName: 'agozie', callReference: 'CALL_720098ef' },
};

describe('an incoming call the server types as a message', () => {
  it('is recognised as a call by the call reference it carries', () => {
    expect(isIncomingCallNotification(incomingCallAsMessage)).toBe(true);
  });

  it('opens the call screen for that call, not the chat', () => {
    const route = resolvePushNotificationRoute(incomingCallAsMessage, 'client');
    expect(route?.pathname).toBe('/CallScreen');
    expect(route?.params).toMatchObject({ callState: 'incoming', requestId: '5' });
  });

  it('still finds the call when its ids come at the top level', () => {
    const flat = { type: 'new_message', requestId: 5, callReference: 'CALL_720098ef', callId: 1 };
    expect(isIncomingCallNotification(flat)).toBe(true);
    expect(resolvePushNotificationRoute(flat, 'client')?.pathname).toBe('/CallScreen');
  });

  it('leaves an ordinary chat message as a chat message', () => {
    const chat = { type: 'new_message', requestId: 5, metadata: { messageId: 9 } };
    expect(isIncomingCallNotification(chat)).toBe(false);
    expect(resolvePushNotificationRoute(chat, 'client')?.pathname).not.toBe('/CallScreen');
  });
});
