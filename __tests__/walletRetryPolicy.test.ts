jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  extractResponseData: (response: any) => response?.data ?? response,
}));

jest.mock('@/utils/paymentFlowLog', () => ({
  logWalletApiError: jest.fn(),
  logWalletApiResponse: jest.fn(),
}));

import { apiClient } from '@/services/api/client';
import { walletService } from '@/services/api/wallet';

const post = apiClient.post as jest.Mock;

/** Third argument of apiClient.post is the per-request RequestConfig. */
function configFor(endpoint: string): Record<string, unknown> | undefined {
  const call = post.mock.calls.find((args) => args[0] === endpoint);
  if (!call) throw new Error(`apiClient.post was never called with ${endpoint}`);
  return call[2];
}

describe('wallet retry policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    post.mockResolvedValue({ data: { reference: 'REF-1', status: 'completed' } });
  });

  /**
   * The client retries any request up to 3 times on a network error. These
   * endpoints are not idempotent and carry no idempotency key, so a retry after
   * a lost response can debit the wallet twice.
   */
  it('does not retry pay-for-service', async () => {
    await walletService.payForService({ requestId: 1, amount: 100, pin: '1234' } as any);

    expect(configFor('/api/wallet/pay')).toEqual(expect.objectContaining({ retries: 0 }));
  });

  it('does not retry the logistics fee payment', async () => {
    await walletService.payLogisticsFee({ requestId: 1, amount: 100, pin: '1234' });

    expect(configFor('/api/wallet/pay-logistics-fee')).toEqual(
      expect.objectContaining({ retries: 0 }),
    );
  });

  it('does not retry a withdrawal', async () => {
    await walletService.withdraw({ bankAccountId: 1, amount: 100, pin: '1234' });

    expect(configFor('/api/wallet/withdraw')).toEqual(expect.objectContaining({ retries: 0 }));
  });

  /** A retry here would burn a PIN attempt against the server's lockout counter. */
  it('does not retry PIN verification', async () => {
    post.mockResolvedValue({ data: { isValid: true } });
    await walletService.verifyPin('1234');

    expect(configFor('/api/wallet/pin/verify')).toEqual(expect.objectContaining({ retries: 0 }));
  });

  /** No money has moved yet — a lost response here should still be retried. */
  it('still retries deposit initialization', async () => {
    post.mockResolvedValue({
      data: { authorizationUrl: 'https://kora.test/pay', reference: 'REF-1' },
    });
    await walletService.initializeDeposit({ amount: 100, email: 'a@b.test' });

    expect(configFor('/api/wallet/deposit')).toBeUndefined();
  });
});
