import AsyncStorage from '@react-native-async-storage/async-storage';

import { ONBOARDING_STORAGE_KEY } from '@/hooks/useOnboarding';
import { ROLE_SWITCHING_KEY } from '@/hooks/useRoleSwitching';

/**
 * What survives signing out: facts about this phone, not about whoever was
 * signed in. Identical in both apps.
 *
 * Sign-out used to remove a hand-kept list of keys and leave everything else,
 * so the next account on the phone inherited the last one's user id (and with
 * it, which chat messages counted as "mine"), a cached "verified" flag, a
 * half-finished booking, saved addresses and signup progress. A new key was
 * a new leak until someone remembered to add it. Now the list is of what to
 * keep, and anything not on it goes.
 */
const DEVICE_KEYS = new Set<string>([
  ONBOARDING_STORAGE_KEY,
  '@ghands:user_role',
  '@ghands:push_token',
  '@ghands:coach_marks_complete',
  '@ghands:dev_client_token',
  '@ghands:dev_provider_token',
  /** Mid-switch between the two apps' roles; clearing it would strand the switch. */
  ROLE_SWITCHING_KEY,
]);

/** Sign-out: everything that belonged to the account. */
export async function clearAccountStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const accountKeys = keys.filter((key) => !DEVICE_KEYS.has(key));
  if (accountKeys.length > 0) await AsyncStorage.multiRemove(accountKeys);
}

/** Reset onboarding: everything, as a fresh install would have. */
export async function clearAllAppStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
}
