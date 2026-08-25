import AsyncStorage from '@react-native-async-storage/async-storage';

import { authService } from '@/services/authService';

export const CLIENT_PROFILE_IMAGE_LEGACY_KEY = '@ghands:client_profile_image_uri';

const LOG_TAG = '[ClientProfilePhoto]';

/** All image-related keys (for dev summaries only). */
const IMAGE_FIELD_KEYS = [
  'profileImageUri',
  'profileImage',
  'profile_image',
  'avatarUrl',
  'avatar',
  'imageUrl',
  'image',
  'photoUrl',
  'photo',
  'picture',
  'profilePicture',
  'profile_picture',
] as const;

/** Profile avatar only — avoids unrelated API `image` / banner fields. */
const PROFILE_AVATAR_FIELD_KEYS = [
  'profileImageUri',
  'profileImage',
  'profile_image',
  'avatarUrl',
  'avatar',
  'profilePicture',
  'profile_picture',
] as const;

const PROVIDER_AVATAR_FIELD_KEYS = [
  ...PROFILE_AVATAR_FIELD_KEYS,
  'photoUrl',
  'imageUrl',
] as const;

export function isDisplayableAvatarUri(uri: string | null | undefined): boolean {
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith('file://')) return true;
  if (trimmed.startsWith('content://')) return true;
  return false;
}

function pickFirstDisplayableUri(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === 'string' && isDisplayableAvatarUri(v)) return v.trim();
  }
  return undefined;
}

/** `authService.getUserId()` yields a number, so the key builders accept both. */
export function clientProfileImageStorageKey(userId: string | number | null | undefined): string {
  if (userId) return `${CLIENT_PROFILE_IMAGE_LEGACY_KEY}:${userId}`;
  return CLIENT_PROFILE_IMAGE_LEGACY_KEY;
}

export function logClientProfilePhoto(
  event: string,
  details?: Record<string, unknown>,
): void {
  if (!__DEV__) return;
  if (details && Object.keys(details).length > 0) {
    console.log(LOG_TAG, event, details);
  } else {
    console.log(LOG_TAG, event);
  }
}

function readProfileRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  if (r.data && typeof r.data === 'object') return r.data as Record<string, unknown>;
  return r;
}

/** Dev: which image-related keys the API returned and their types (not full URLs). */
export function summarizeProfileImageFields(raw: unknown): Record<string, string> {
  const d = readProfileRecord(raw);
  const out: Record<string, string> = {};
  for (const key of IMAGE_FIELD_KEYS) {
    const v = d[key];
    if (v == null || v === '') continue;
    if (typeof v === 'string') {
      out[key] = v.startsWith('http') ? `${v.slice(0, 48)}…` : v.slice(0, 48);
    } else {
      out[key] = typeof v;
    }
  }
  return out;
}

export function pickProfileImageUriFromApi(raw: unknown): string | undefined {
  const d = readProfileRecord(raw);
  return pickFirstDisplayableUri(d, PROFILE_AVATAR_FIELD_KEYS);
}

export function pickProviderImageUriFromRecord(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return pickFirstDisplayableUri(raw as Record<string, unknown>, PROVIDER_AVATAR_FIELD_KEYS);
}

export async function readLocalClientProfileImageUri(
  userId?: string | number | null,
): Promise<string | null> {
  const id = userId ?? (await authService.getUserId());
  const key = clientProfileImageStorageKey(id);
  const legacy = await AsyncStorage.getItem(CLIENT_PROFILE_IMAGE_LEGACY_KEY);
  const scoped = await AsyncStorage.getItem(key);
  const uri = scoped ?? legacy;
  logClientProfilePhoto('local_cache_read', {
    userId: id ?? null,
    storageKey: key,
    hit: !!uri,
    uriPreview: uri ? `${uri.slice(0, 40)}…` : null,
  });
  return uri;
}

export async function writeLocalClientProfileImageUri(uri: string): Promise<void> {
  const trimmed = uri.trim();
  if (!trimmed) return;
  const userId = await authService.getUserId();
  const key = clientProfileImageStorageKey(userId);
  await AsyncStorage.setItem(key, trimmed);
  await AsyncStorage.setItem(CLIENT_PROFILE_IMAGE_LEGACY_KEY, trimmed);
  logClientProfilePhoto('local_cache_write', {
    userId: userId ?? null,
    storageKey: key,
    uriPreview: `${trimmed.slice(0, 40)}…`,
  });
}

export async function clearLocalClientProfileImageUri(): Promise<void> {
  const userId = await authService.getUserId();
  await AsyncStorage.multiRemove([
    clientProfileImageStorageKey(userId),
    CLIENT_PROFILE_IMAGE_LEGACY_KEY,
  ]);
  logClientProfilePhoto('local_cache_clear', { userId: userId ?? null });
}
