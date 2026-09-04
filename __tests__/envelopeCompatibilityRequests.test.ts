jest.mock('@/services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

import { apiClient } from '@/services/api/client';
import { serviceRequestService } from '@/services/api/serviceRequest';

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const OLD = (payload: unknown) => ({ success: true, message: 'Success', data: { data: payload } });
const NEW = (payload: unknown) => ({ success: true, message: 'Success', data: payload });

/**
 * Second half of the envelope-change check, for the service-request path.
 * getRequestDetails is the interesting one: it calls extractResponseData
 * directly with no `?.data` fallback of its own, so it is the shape most
 * exposed to a change in nesting depth.
 */
describe('service requests survive the envelope change', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getRequestDetails', () => {
    const payload = {
      id: 812,
      categoryName: 'airConditioning',
      jobTitle: 'AC not cooling',
      description: 'Living room unit blows warm air',
      status: 'pending',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-01T10:00:00Z',
    };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const request = await serviceRequestService.getRequestDetails(812);
      expect(request.id).toBe(812);
      expect(request.jobTitle).toBe('AC not cooling');
      expect(request.status).toBe('pending');
    });
  });

  describe('getUserRequests', () => {
    const payload = [
      { id: 1, jobTitle: 'Job one', description: 'd', status: 'pending', categoryName: 'plumbing' },
      { id: 2, jobTitle: 'Job two', description: 'd', status: 'accepted', categoryName: 'electrical' },
    ];

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const requests = await serviceRequestService.getUserRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].jobTitle).toBe('Job one');
    });
  });

  describe('createRequest', () => {
    const payload = { requestId: 900, categoryName: 'plumbing', status: 'draft', message: 'created' };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      post.mockResolvedValue(body);
      const created = await serviceRequestService.createRequest({ userId: 1, categoryName: 'plumbing' } as any);
      expect(created.requestId).toBe(900);
    });
  });

  describe('getQuotations', () => {
    const payload = [{ id: 5, total: 50000, status: 'pending', provider: { id: 2, name: 'Ada' } }];

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const quotes = await serviceRequestService.getQuotations(812);
      expect(quotes).toHaveLength(1);
      expect(quotes[0].total).toBe(50000);
    });
  });

  describe('getCategories', () => {
    const payload = [{ name: 'plumbing', displayName: 'Plumbing', description: 'Pipes', providerCount: 0 }];

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const categories = await serviceRequestService.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].displayName).toBe('Plumbing');
    });
  });
});
