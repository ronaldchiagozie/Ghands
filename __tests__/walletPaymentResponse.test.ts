jest.mock('@/services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: (response: any) => response?.data ?? response,
}));

jest.mock('@/utils/paymentFlowLog', () => ({
  logWalletApiError: jest.fn(),
  logWalletApiResponse: jest.fn(),
}));

import { apiClient } from '@/services/api/client';
import { walletService } from '@/services/api/wallet';

const post = apiClient.post as jest.Mock;

const pay = () => walletService.payForService({ requestId: 7, amount: 5000, pin: '1234' } as any);

describe('payment response normalization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads a result wrapped once in data', async () => {
    post.mockResolvedValue({ data: { reference: 'REF-1', status: 'completed', amount: 5000, balance: 1000 } });

    await expect(pay()).resolves.toEqual(
      expect.objectContaining({ reference: 'REF-1', status: 'completed', amount: 5000, balance: 1000 }),
    );
  });

  /** The shape payLogisticsFee assumed and payForService did not. */
  it('reads a result wrapped twice in data', async () => {
    post.mockResolvedValue({ data: { data: { reference: 'REF-2', status: 'completed', amount: 5000 } } });

    await expect(pay()).resolves.toEqual(
      expect.objectContaining({ reference: 'REF-2', status: 'completed' }),
    );
  });

  it('reads a bare result with no envelope', async () => {
    post.mockResolvedValue({ reference: 'REF-3', status: 'pending' });

    await expect(pay()).resolves.toEqual(
      expect.objectContaining({ reference: 'REF-3', status: 'pending' }),
    );
  });

  /**
   * The regression that made the unwrap inconsistency dangerous: reading the
   * wrong layer yields no status, and the payment screens treat a statusless
   * 2xx as a completed debit. Unknown must degrade to `pending` so the screen
   * polls the ledger for a real verdict instead of showing a receipt.
   */
  it('never reports success for a response it cannot read', async () => {
    post.mockResolvedValue({ data: { somethingElse: true } });

    await expect(pay()).resolves.toEqual(expect.objectContaining({ status: 'pending' }));
  });

  it('treats a missing status as pending, not completed', async () => {
    post.mockResolvedValue({ data: { reference: 'REF-4', amount: 5000 } });

    await expect(pay()).resolves.toEqual(
      expect.objectContaining({ reference: 'REF-4', status: 'pending' }),
    );
  });

  it('maps the success vocabulary the API varies across', async () => {
    for (const raw of ['completed', 'success', 'successful', 'paid', 'approved']) {
      post.mockResolvedValue({ data: { reference: 'REF', status: raw } });
      await expect(pay()).resolves.toEqual(expect.objectContaining({ status: 'completed' }));
    }
  });

  it('maps the failure vocabulary', async () => {
    for (const raw of ['failed', 'cancelled', 'canceled', 'declined']) {
      post.mockResolvedValue({ data: { reference: 'REF', status: raw } });
      await expect(pay()).resolves.toEqual(expect.objectContaining({ status: 'failed' }));
    }
  });

  it('falls back to transactionId when there is no reference', async () => {
    post.mockResolvedValue({ data: { transactionId: 'TXN-9', status: 'completed' } });

    await expect(pay()).resolves.toEqual(expect.objectContaining({ reference: 'TXN-9' }));
  });

  it('carries the requested requestId through when the API omits it', async () => {
    post.mockResolvedValue({ data: { reference: 'REF-5', status: 'completed' } });

    await expect(pay()).resolves.toEqual(expect.objectContaining({ requestId: 7 }));
  });

  it('surfaces the amount the server says it debited, not the requested one', async () => {
    post.mockResolvedValue({ data: { reference: 'REF-6', status: 'completed', amount: 4500 } });

    await expect(pay()).resolves.toEqual(expect.objectContaining({ amount: 4500 }));
  });

  it('normalizes the logistics fee response the same way', async () => {
    post.mockResolvedValue({ data: { data: { reference: 'REF-7', status: 'success', amount: 1500 } } });

    await expect(
      walletService.payLogisticsFee({ requestId: 7, amount: 1500, pin: '1234' }),
    ).resolves.toEqual(expect.objectContaining({ reference: 'REF-7', status: 'completed' }));
  });
});
