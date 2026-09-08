jest.mock('@/services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

jest.mock('@/services/authService', () => ({
  authService: { getAuthToken: jest.fn(async () => 'token') },
}));

jest.mock('@/utils/aiImageUpload', () => ({
  guessMimeAndName: jest.fn(),
  uploadImageUris: jest.fn(async () => []),
}));

import { apiClient } from '@/services/api/client';
import { aiService } from '@/services/api/ai';

const post = apiClient.post as jest.Mock;

/**
 * Sending a message must never be repeated for us.
 *
 * The client retries a failed POST three more times by default, and
 * `/api/ai/chat` carries no idempotency key - so every attempt that reaches
 * the server stores the message again. A slow reply is exactly when a retry
 * fires, and a language model on a cold instance is slow by nature, which is
 * how one "Hey" became four identical messages in the thread.
 *
 * Nothing looked wrong while the app forgot the conversation on every open:
 * the copies sat on the server, unread. Reopening the last thread put them on
 * screen.
 */
describe('Handy writes', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ success: true, data: { conversationId: 1, message: 'ok' } });
  });

  const configOf = (call: unknown[]) => (call?.[2] ?? {}) as { retries?: number };

  it('does not retry a chat message', async () => {
    await aiService.sendMessage({ message: 'Hey' });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('/api/ai/chat');
    expect(configOf(post.mock.calls[0]).retries).toBe(0);
  });

  it('does not retry a booking raised from a suggestion', async () => {
    post.mockResolvedValue({ success: true, data: { requestId: 9 } });

    await aiService.quickBooking({ categoryName: 'plumbing' } as never);

    expect(configOf(post.mock.calls[0]).retries).toBe(0);
  });

  /**
   * The guard that matters: zero has to survive as zero. The client treats a
   * missing value as "use the default of three", so anything that turns this
   * into undefined on the way through puts the duplicates straight back.
   */
  it('sends a real zero, not an absent value', async () => {
    await aiService.sendMessage({ message: 'Hey' });

    const config = configOf(post.mock.calls[0]);
    expect(config).toHaveProperty('retries');
    expect(config.retries).not.toBeUndefined();
  });
});
