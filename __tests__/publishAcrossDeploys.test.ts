/**
 * Publishing a booking without a coordinated release.
 *
 * Today `select-provider` moves a request out of draft. Under the agreed
 * change it will only record the choice, and `/confirm` will take the provider
 * and publish. Those are opposite behaviours on the same two endpoints, so
 * shipping either side first breaks bookings: too early and nothing publishes,
 * too late and nothing publishes.
 *
 * The two versions of `/confirm` answer differently, and that is enough to tell
 * them apart. The current one validates and returns the request unchanged, so
 * it comes back still `draft`. The new one comes back `pending`.
 */
jest.mock('@/services/api/client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

import { apiClient } from '@/services/api/client';
import { serviceRequestService } from '@/services/api/serviceRequest';

const post = apiClient.post as jest.Mock;
const CONFIRM = '/api/request-service/requests/418/confirm';
const SELECT = '/api/request-service/requests/418/select-provider';

const pathsCalled = () => post.mock.calls.map((c) => c[0]);

describe('publishBooking', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('against the backend as it is today', () => {
    it('falls back when confirm returns the request still in draft', async () => {
      post.mockImplementation(async (path: string) =>
        path === CONFIRM
          ? { data: { id: 418, status: 'draft' } }
          : { data: { requestId: 418, status: 'pending' } },
      );

      await serviceRequestService.publishBooking(418, 31);

      expect(pathsCalled()).toEqual([CONFIRM, SELECT]);
    });

    it('falls back when confirm refuses the extra field', async () => {
      post.mockImplementation(async (path: string) => {
        if (path === CONFIRM) throw Object.assign(new Error('"providerId" is not allowed'), { status: 400 });
        return { data: { requestId: 418, status: 'pending' } };
      });

      await serviceRequestService.publishBooking(418, 31);

      expect(pathsCalled()).toEqual([CONFIRM, SELECT]);
    });

    it('falls back when confirm does not exist at all', async () => {
      post.mockImplementation(async (path: string) => {
        if (path === CONFIRM) throw Object.assign(new Error('Not found'), { status: 404 });
        return { data: { requestId: 418, status: 'pending' } };
      });

      await serviceRequestService.publishBooking(418, 31);

      expect(pathsCalled()).toEqual([CONFIRM, SELECT]);
    });
  });

  describe('against the backend after the change', () => {
    it('publishes with confirm and does not touch select-provider', async () => {
      post.mockResolvedValue({ data: { id: 418, status: 'pending', provider: { id: 31 } } });

      await serviceRequestService.publishBooking(418, 31);

      expect(pathsCalled()).toEqual([CONFIRM]);
      expect(post).toHaveBeenCalledWith(CONFIRM, { providerId: 31 });
    });

    it('sends the provider the customer actually chose', async () => {
      post.mockResolvedValue({ data: { status: 'pending' } });

      await serviceRequestService.publishBooking(418, 77);

      expect(post).toHaveBeenCalledWith(CONFIRM, { providerId: 77 });
    });
  });

  /**
   * The failure that matters. A booking that did not publish must raise, not
   * return quietly, because the screen treats a resolved promise as booked.
   */
  it('raises when neither endpoint publishes', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === CONFIRM) throw Object.assign(new Error('Not found'), { status: 404 });
      throw new Error('Select a date and time before selecting a provider');
    });

    await expect(serviceRequestService.publishBooking(418, 31)).rejects.toThrow(
      'Select a date and time',
    );
  });

  /**
   * A code naming what is missing means the booking is genuinely incomplete.
   * Falling back to select-provider would only produce the same refusal with a
   * vaguer message, and would lose the code the screen needs to send the
   * customer to the step that is empty.
   */
  describe('when the booking itself is not ready', () => {
    const rejection = (code: string) =>
      Object.assign(new Error('Add the job title and description'), { status: 400, code });

    it.each([
      'MISSING_JOB_DETAILS',
      'MISSING_SCHEDULE',
      'MISSING_LOCATION',
      'PROVIDER_NOT_SELECTED',
      'PROVIDER_NOT_VERIFIED',
      'REQUEST_NOT_SELECTABLE',
    ])('raises %s instead of retrying the other endpoint', async (code) => {
      post.mockImplementation(async (path: string) => {
        if (path === CONFIRM) throw rejection(code);
        return { data: { requestId: 418, status: 'pending' } };
      });

      await expect(serviceRequestService.publishBooking(418, 31)).rejects.toMatchObject({ code });
      expect(pathsCalled()).toEqual([CONFIRM]);
    });
  });
});
