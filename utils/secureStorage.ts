import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_PREFIX = 'ghands.secure.';

function secureKey(key: string): string {
  return `${SECURE_PREFIX}${key.replace(/^@ghands:/, '')}`;
}

/**
 * Sensitive values (tokens) - SecureStore on native, AsyncStorage on web.
 * Migrates legacy AsyncStorage entries on first read.
 */
export async function getSecureItem(key: string): Promise<string | null> {
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
