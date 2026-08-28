import AsyncStorage from '@react-native-async-storage/async-storage';

import { mapApiProfileToUserProfile } from '@/hooks/useProfile';
import { profileService } from '@/services/api';
import { authService } from '@/services/authService';
import { isCompanyClientAccount, setClientAccountType } from '@/utils/clientAccountType';
import { unwrapProfilePayload } from '@/utils/profilePayload';

/** Legacy key; also mirrored per user id when available. */
export const PROFILE_COMPLETE_LEGACY_KEY = '@ghands:profile_complete';

/** `authService.getUserId()` yields a number, so the key builders accept both. */
export function profileCompleteKeyForUser(userId: string | number | null | undefined): string {
  if (userId) return `${PROFILE_COMPLETE_LEGACY_KEY}:${userId}`;
  return PROFILE_COMPLETE_LEGACY_KEY;
}

/**
 * Must stay in step with what ProfileCompletionModal actually demands: name,
 * phone AND gender. It previously checked only name and phone, so an account
 * missing gender counted as complete — the setup checklist hid the task while
 * the form still refused to submit without it.
 *
 * `gender` is optional in the signature so existing two-argument callers keep
 * their meaning; pass it wherever the value is known.
 */
export function isProfileDetailsComplete(name: string, phone: string, gender?: string): boolean {
  const trimmedName = name.trim();
  const digits = phone.replace(/\D/g, '');
  if (trimmedName.length < 3 || digits.length < 10) return false;
  if (gender !== undefined && !String(gender).trim()) return false;
  return true;
}

export async function readProfileCompleteFlag(userId: string | number | null): Promise<boolean> {
  const keys = userId
    ? [profileCompleteKeyForUser(userId), PROFILE_COMPLETE_LEGACY_KEY]
    : [PROFILE_COMPLETE_LEGACY_KEY];
  for (const key of keys) {
    const value = await AsyncStorage.getItem(key);
    if (value === 'true') return true;
  }
  return false;
}

export async function writeProfileCompleteFlag(userId: string | number | null): Promise<void> {
  await AsyncStorage.setItem(PROFILE_COMPLETE_LEGACY_KEY, 'true');
  if (userId) {
    await AsyncStorage.setItem(profileCompleteKeyForUser(userId), 'true');
  }
}

/** True when `/api/user/profile` already has a usable name and phone (individual or company). */
export async function resolveProfileCompleteFromServer(): Promise<boolean> {
  try {
    const raw = await profileService.getCurrentUserProfile();
    const mapped = mapApiProfileToUserProfile(raw);
    const genderRaw = String(unwrapProfilePayload(raw).gender ?? '').trim();
    const complete = isProfileDetailsComplete(mapped.name, mapped.phone, genderRaw);
    if (complete && raw && typeof raw === 'object') {
      const d = unwrapProfilePayload(raw);
      const companyName = String(d.companyName ?? d.company_name ?? '').trim();
      if (companyName.length >= 2) {
        await setClientAccountType('company');
      }
    }
    return complete;
  } catch {
    return false;
  }
}

export async function resolveClientProfileComplete(): Promise<boolean> {
  if (await isCompanyClientAccount()) {
    return true;
  }
  const userId = await authService.getUserId();
  if (await readProfileCompleteFlag(userId)) return true;
  const fromServer = await resolveProfileCompleteFromServer();
  if (fromServer) {
    await writeProfileCompleteFlag(userId);
  }
  return fromServer;
}
