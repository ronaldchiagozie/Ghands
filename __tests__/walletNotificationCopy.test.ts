import type { Notification } from '@/services/api';
import {
  resolveWalletNotificationStatus,
  walletNotificationPresentation,
} from '@/utils/walletNotificationCopy';

describe('walletNotificationPresentation', () => {
  const base: Notification = {
    id: 1,
    userId: 1,
    type: 'deposit_success',
    status: 'unread',
    title: 'Deposit completed',
    message: 'Payment completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('shows failed copy when type is success but metadata status is failed', () => {
    const ui = walletNotificationPresentation(
      {
        ...base,
        metadata: { status: 'failed', amount: 100, transactionType: 'deposit' },
      },
      'Payment completed',
    );
    expect(ui?.typeLabel).toBe('Deposit failed');
    expect(ui?.tone).toBe('error');
    expect(ui?.description).toMatch(/not added/i);
  });

  it('resolveWalletNotificationStatus prefers metadata over success type', () => {
    expect(
      resolveWalletNotificationStatus({
        ...base,
        metadata: { status: 'failed', transactionType: 'deposit' },
      }),
    ).toBe('failed');
  });

  it('uses ledger status when notification type says success', () => {
    const ui = walletNotificationPresentation(
      {
        ...base,
        transactionId: 169,
        metadata: { amount: 100, type: 'deposit' },
      },
      'Payment completed',
      {
        transactionById: new Map([
          [
            169,
            {
              id: 169,
              type: 'deposit',
              status: 'failed',
              amount: 100,
              completedAt: null,
            },
          ],
        ]),
      },
    );
    expect(ui?.typeLabel).toBe('Deposit failed');
    expect(ui?.tone).toBe('error');
  });
});
