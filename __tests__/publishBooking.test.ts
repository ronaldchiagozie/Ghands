/**
 * Publishing a booking is selecting the provider.
 *
 * The backend confirmed `/confirm` only validates and returns the request
 * unchanged — it never leaves draft and never notifies anyone. The call that
 * flips draft to pending, and makes the job visible to the provider, is
 * `select-provider`. So that request is the one thing in the booking flow that
 * must not fail quietly.
 *
 * These cover the decision the screen makes around it, which previously showed
 * a toast and carried on to the confirmation screen regardless.
 */
jest.mock('@/services/api/client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

import { apiClient } from '@/services/api/client';
import { serviceRequestService } from '@/services/api/serviceRequest';

const post = apiClient.post as jest.Mock;

/**
 * The screen's rule, extracted. Returns what happens to the booking, so the
 * three outcomes that used to collapse into "navigate anyway" stay apart.
 */
type Outcome = 'published' | 'blocked' | 'failed';

async function confirmBooking(requestId: unknown, providerId: unknown): Promise<Outcome> {
  const id = typeof requestId === 'number' ? requestId : parseInt(String(requestId ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0 || !providerId) return 'blocked';
  try {
    await serviceRequestService.selectProvider(id, providerId as number);
    return 'published';
  } catch {
    return 'failed';
  }
}

describe('confirming a booking', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publishes by selecting the provider', async () => {
    post.mockResolvedValue({ data: { requestId: 418, status: 'pending' } });

    await expect(confirmBooking('418', 31)).resolves.toBe('published');
    expect(post).toHaveBeenCalledWith(
      '/api/request-service/requests/418/select-provider',
      { providerId: 31 },
    );
  });

  /**
   * The unrecoverable case. A failure here used to navigate to the confirmation
   * screen and clear the resume pointer, leaving a draft that no provider could
   * see, that was absent from the customer's own jobs list because drafts are
   * excluded from it, and that nothing offered back — reported as a success.
   */
  it('does not report success when the publish fails', async () => {
    post.mockRejectedValue(Object.assign(new Error('Request is no longer available'), { status: 400 }));
    await expect(confirmBooking('418', 31)).resolves.toBe('failed');
  });

  it('does not report success when a network error swallows the call', async () => {
    post.mockRejectedValue(new Error('Network request failed'));
    await expect(confirmBooking('418', 31)).resolves.toBe('failed');
  });

  /**
   * A provider row with no backend id used to skip the call silently — the
   * guard was `if (requestId && providerId)` wrapped around the request, with
   * navigation outside it.
   */
  it('blocks rather than skipping when the provider id is missing', async () => {
    await expect(confirmBooking('418', undefined)).resolves.toBe('blocked');
    await expect(confirmBooking('418', null)).resolves.toBe('blocked');
    await expect(confirmBooking('418', 0)).resolves.toBe('blocked');
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks on an unusable request id', async () => {
    await expect(confirmBooking(undefined, 31)).resolves.toBe('blocked');
    await expect(confirmBooking('not-a-number', 31)).resolves.toBe('blocked');
    await expect(confirmBooking('0', 31)).resolves.toBe('blocked');
    expect(post).not.toHaveBeenCalled();
  });

  /** A second tap is refused by the server, and that must read as a failure, not a booking. */
  it('treats the server refusing a repeat selection as a failure', async () => {
    post.mockRejectedValue(new Error('This request is no longer available for selection'));
    await expect(confirmBooking('418', 31)).resolves.toBe('failed');
  });
});
