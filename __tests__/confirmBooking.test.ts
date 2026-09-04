/**
 * Publishing a booking.
 *
 * The backend creates a request as a draft and excludes drafts from the lists
 * providers read. Nothing in the app ever called the endpoint that publishes it,
 * so a finished booking would sit invisible while the customer waited on a map
 * for offers that had never been requested.
 *
 * The call has to be forgiving, because the screen it runs on is reachable more
 * than once and is deployed against backends that may not have the endpoint.
 */
jest.mock('@/services/api/client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

import { apiClient } from '@/services/api/client';
import { serviceRequestService } from '@/services/api/serviceRequest';

/**
 * Read off the imported module rather than captured in the factory closure: the
 * factory runs at import-hoist time, when a `const` declared above it is still
 * undefined.
 */
const mockPost = apiClient.post as jest.Mock;

describe('confirmRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publishes the request', async () => {
    mockPost.mockResolvedValue({ data: { status: 'pending' } });
    await serviceRequestService.confirmRequest(42);
    expect(mockPost).toHaveBeenCalledWith('/api/request-service/requests/42/confirm', {});
  });

  /** A deployment without the endpoint published on creation; there is nothing to do. */
  it('treats a missing endpoint as nothing to do', async () => {
    const notFound: any = new Error('Not found');
    notFound.status = 404;
    mockPost.mockRejectedValue(notFound);
    await expect(serviceRequestService.confirmRequest(42)).resolves.toBeUndefined();
  });

  /** Re-entering the map screen must not surface an error over an already-live job. */
  it('treats a repeat confirmation as success', async () => {
    mockPost.mockRejectedValue(new Error('Request already confirmed'));
    await expect(serviceRequestService.confirmRequest(42)).resolves.toBeUndefined();

    mockPost.mockRejectedValue({ details: { error: 'This request has already been published' } });
    await expect(serviceRequestService.confirmRequest(42)).resolves.toBeUndefined();
  });

  /**
   * The important half. Swallowing everything would hide the exact failure this
   * was written for — a booking that never reaches a provider.
   */
  it('re-throws a real failure rather than leaving the job unpublished', async () => {
    const serverError: any = new Error('Internal server error');
    serverError.status = 500;
    mockPost.mockRejectedValue(serverError);
    await expect(serviceRequestService.confirmRequest(42)).rejects.toThrow('Internal server error');

    const badRequest: any = new Error('Request is missing a scheduled date');
    badRequest.status = 400;
    mockPost.mockRejectedValue(badRequest);
    await expect(serviceRequestService.confirmRequest(42)).rejects.toThrow('missing a scheduled date');
  });
});
