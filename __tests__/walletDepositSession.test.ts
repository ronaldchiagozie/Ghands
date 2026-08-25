import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEPOSIT_REFERENCE_KEY,
  clearHandledDepositReference,
  clearPendingDepositReference,
  getHandledDepositReference,
  getPendingDepositReference,
  isDepositReferenceAlreadyHandled,
  markDepositReferenceHandled,
  setPendingDepositReference,
} from '@/utils/walletDepositSession';

describe('walletDepositSession', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  /**
   * The Kora handoff survives the app being killed only if the reference is on
   * disk. TopUpScreen once called a same-named useState setter here instead of
   * this helper, so nothing was ever written and every cold-start / deep-link
   * reconcile found nothing to verify.
   */
  it('persists the pending reference so a cold start can reconcile it', async () => {
    await setPendingDepositReference('REF-1');

    expect(await getPendingDepositReference()).toBe('REF-1');
    expect(await AsyncStorage.getItem(DEPOSIT_REFERENCE_KEY)).toBe('REF-1');
  });

  it('reports no pending reference before a deposit is started', async () => {
    expect(await getPendingDepositReference()).toBeNull();
  });

  it('clears the pending reference on cancel', async () => {
    await setPendingDepositReference('REF-1');
    await clearPendingDepositReference();

    expect(await getPendingDepositReference()).toBeNull();
  });

  it('marking handled retires the pending reference and blocks a second credit', async () => {
    await setPendingDepositReference('REF-1');
    await markDepositReferenceHandled('REF-1');

    expect(await getPendingDepositReference()).toBeNull();
    expect(await getHandledDepositReference()).toBe('REF-1');
    expect(await isDepositReferenceAlreadyHandled('REF-1')).toBe(true);
  });

  it('does not treat a different reference as already handled', async () => {
    await markDepositReferenceHandled('REF-1');

    expect(await isDepositReferenceAlreadyHandled('REF-2')).toBe(false);
  });

  it('clears the handled marker when a new deposit starts', async () => {
    await markDepositReferenceHandled('REF-1');
    await clearHandledDepositReference();

    expect(await isDepositReferenceAlreadyHandled('REF-1')).toBe(false);
  });
});
