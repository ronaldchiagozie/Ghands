jest.mock('@/services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

jest.mock('@/utils/paymentFlowLog', () => ({
  logWalletApiError: jest.fn(),
  logWalletApiResponse: jest.fn(),
}));

import { apiClient } from '@/services/api/client';
import { walletService } from '@/services/api/wallet';

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

/**
 * The backend is removing a level of nesting from every success response:
 *
 *   before   { success, message, data: { data: PAYLOAD } }
 *   after    { success, message, data: PAYLOAD }
 *
 * Their own writeup calls this "the highest mobile-coordination risk in this
 * whole set" and asks for a simultaneous release. These tests check whether that
 * is actually necessary: each one feeds both envelope shapes through the real
 * service function and asserts the same result. Anything that passes both is
 * safe to deploy in either order.
 */
const OLD = (payload: unknown) => ({ success: true, message: 'Success', data: { data: payload } });
const NEW = (payload: unknown) => ({ success: true, message: 'Success', data: payload });

describe('wallet responses survive the envelope change', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getWallet', () => {
    const payload = { id: 3, balance: 4500, currency: 'NGN', isPinSet: true };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const wallet = await walletService.getWallet();
      expect(wallet.balance).toBe(4500);
      expect(wallet.isPinSet).toBe(true);
      expect(wallet.currency).toBe('NGN');
    });
  });

  describe('getBankAccounts', () => {
    const payload = [{ id: 1, bankName: 'GTB', accountNumber: '0123456789', accountName: 'A B', isDefault: true }];

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const accounts = await walletService.getBankAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].bankName).toBe('GTB');
    });
  });

  describe('getTransactions', () => {
    const payload = { transactions: [{ id: 1, reference: 'REF-1', amount: 500 }], total: 1, limit: 50, offset: 0 };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const result = await walletService.getTransactions();
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('verifyDeposit', () => {
    const payload = { reference: 'DEP-1', status: 'completed', amount: 1000, balance: 5500 };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const verification = await walletService.verifyDeposit('DEP-1');
      expect(verification.status).toBe('completed');
      expect(verification.amount).toBe(1000);
      expect(verification.balance).toBe(5500);
    });
  });

  describe('initializeDeposit', () => {
    const payload = { authorizationUrl: 'https://kora.test/pay', reference: 'DEP-2' };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      post.mockResolvedValue(body);
      const result = await walletService.initializeDeposit({ amount: 1000, email: 'a@b.test' });
      expect(result.reference).toBe('DEP-2');
      expect(result.authorizationUrl).toBe('https://kora.test/pay');
    });
  });

  describe('payForService', () => {
    const payload = { reference: 'PAY-1', status: 'completed', amount: 50000, balance: 0, requestId: 812 };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      post.mockResolvedValue(body);
      const result = await walletService.payForService({ requestId: 812, amount: 50000, pin: '1234' } as any);
      expect(result.status).toBe('completed');
      expect(result.reference).toBe('PAY-1');
      expect(result.amount).toBe(50000);
    });
  });

  describe('withdraw', () => {
    const payload = { reference: 'WD-1', status: 'pending', amount: 3000, balance: 1500 };

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      post.mockResolvedValue(body);
      const result = await walletService.withdraw({ bankAccountId: 1, amount: 3000, pin: '1234' });
      expect(result.reference).toBe('WD-1');
      expect(result.status).toBe('pending');
    });
  });

  describe('verifyPin', () => {
    it.each([['old', OLD({ isValid: true })], ['new', NEW({ isValid: true })]])('%s envelope', async (_label, body) => {
      post.mockResolvedValue(body);
      expect((await walletService.verifyPin('1234')).isValid).toBe(true);
    });
  });

  describe('getBanks', () => {
    const payload = [{ code: '058', name: 'GTBank' }];

    it.each([['old', OLD(payload)], ['new', NEW(payload)]])('%s envelope', async (_label, body) => {
      get.mockResolvedValue(body);
      const banks = await walletService.getBanks();
      expect(banks).toHaveLength(1);
      expect(banks[0].name).toBe('GTBank');
    });
  });
});
