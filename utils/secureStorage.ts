import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_PREFIX = 'ghands.secure.';

function secureKey(key: string): string {
  return `${SECURE_PREFIX}${key.replace(/^@ghands:/, '')}`;
}

/**
 * One read per key at a time.
 *
 * The migration below moves a legacy AsyncStorage value into SecureStore and
 * then deletes the old copy, and that is only safe if it happens once. Several
 * screens load at the same moment on every tab, so two reads would interleave
 * like this:
 *
 *   A: SecureStore empty, reads legacy, writes it across, deletes the legacy copy
 *   B: SecureStore read already returned empty, falls back to legacy, finds
 *      nothing because A just deleted it, and reports no token
 *
 * A missing token is treated as a dead session, so B signed the person out
 * mid-screen while A was holding the very token they were signed out for. It
 * looked like the session dying at random, and it was really two reads racing.
 *
 * Sharing the in-flight promise means the second caller waits for the first and
 * gets the same answer.
 */
const readsInFlight = new Map<string, Promise<string | null>>();

async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }

  try {
    const stored = await SecureStore.getItemAsync(secureKey(key));
    if (stored) return stored;

    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      try {
        await SecureStore.setItemAsync(secureKey(key), legacy);
        await AsyncStorage.removeItem(key);
      } catch {
        return legacy;
      }
      return legacy;
    }
    return null;
  } catch {
    return AsyncStorage.getItem(key);
  }
}

/**
 * Sensitive values (tokens): SecureStore on native, AsyncStorage on web.
 * Migrates legacy AsyncStorage entries on first read.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  const existing = readsInFlight.get(key);
  if (existing) return existing;

  const read = readItem(key).finally(() => {
    readsInFlight.delete(key);
  });
  readsInFlight.set(key, read);
  return read;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(secureKey(key), value);
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(secureKey(key));
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(key);
}

export async function removeSecureItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => removeSecureItem(key)));
}
