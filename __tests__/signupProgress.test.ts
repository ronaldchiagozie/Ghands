import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearSignupProgress,
  getSignupStartedAt,
  getSignupStep,
  recordSignupStep,
} from '@/utils/signupProgress';

describe('signup progress', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('records the step reached', async () => {
    await recordSignupStep('credentials');
    expect(await getSignupStep()).toBe('credentials');
  });

  /**
   * Screens can be revisited — going back to the account-type picker after
   * creating an account must not make the app think signup restarted.
   */
  it('never moves backwards', async () => {
    await recordSignupStep('account_created');
    await recordSignupStep('account_type');
    expect(await getSignupStep()).toBe('account_created');
  });

  it('moves forward through the flow', async () => {
    await recordSignupStep('account_type');
    await recordSignupStep('credentials');
    await recordSignupStep('account_created');
    await recordSignupStep('profile');
    expect(await getSignupStep()).toBe('profile');
  });

  it('stamps when signup began, and keeps the original time', async () => {
    await recordSignupStep('account_type');
    const first = await getSignupStartedAt();
    expect(first).toBeTruthy();

    await recordSignupStep('credentials');
    expect(await getSignupStartedAt()).toBe(first);
  });

  it('reports nothing before signup starts', async () => {
    expect(await getSignupStep()).toBeNull();
    expect(await getSignupStartedAt()).toBeNull();
  });

  it('clears once signup finishes', async () => {
    await recordSignupStep('profile');
    await clearSignupProgress();
    expect(await getSignupStep()).toBeNull();
    expect(await getSignupStartedAt()).toBeNull();
  });
});
