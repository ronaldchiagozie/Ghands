import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEPOSIT_REFERENCE_KEY = '@ghands:pending_deposit_reference';
/** Set as soon as a reference is verified completed — prevents duplicate verify calls (double credit). */
export const DEPOSIT_HANDLED_REF_KEY = '@ghands:deposit_handled_reference';

export async function getPendingDepositReference(): Promise<string | null> {
  return AsyncStorage.getItem(DEPOSIT_REFERENCE_KEY);
}

export async function setPendingDepositReference(reference: string): Promise<void> {
  await AsyncStorage.setItem(DEPOSIT_REFERENCE_KEY, reference);
}

export async function clearPendingDepositReference(): Promise<void> {
  await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
}

export async function getHandledDepositReference(): Promise<string | null> {
  return AsyncStorage.getItem(DEPOSIT_HANDLED_REF_KEY);
}

export async function markDepositReferenceHandled(reference: string): Promise<void> {
  await AsyncStorage.setItem(DEPOSIT_HANDLED_REF_KEY, reference);
  await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
}

export async function clearHandledDepositReference(): Promise<void> {
  await AsyncStorage.removeItem(DEPOSIT_HANDLED_REF_KEY);
}

export async function isDepositReferenceAlreadyHandled(reference: string): Promise<boolean> {
  const handled = await getHandledDepositReference();
  return handled === reference;
}
