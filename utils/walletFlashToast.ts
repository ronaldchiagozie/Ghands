import AsyncStorage from '@react-native-async-storage/async-storage';

export const WALLET_FLASH_TOAST_KEY = '@ghands:wallet_flash_toast';

export type WalletFlashToast = {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  durationMs?: number;
};

export async function setWalletFlashToast(payload: WalletFlashToast): Promise<void> {
  await AsyncStorage.setItem(WALLET_FLASH_TOAST_KEY, JSON.stringify(payload));
}

export async function consumeWalletFlashToast(): Promise<WalletFlashToast | null> {
  try {
    const raw = await AsyncStorage.getItem(WALLET_FLASH_TOAST_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(WALLET_FLASH_TOAST_KEY);
    return JSON.parse(raw) as WalletFlashToast;
  } catch {
    return null;
  }
}
