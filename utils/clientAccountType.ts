import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLIENT_ACCOUNT_TYPE_KEY = '@ghands:client_account_type';

export type ClientAccountType = 'individual' | 'company';

export async function setClientAccountType(type: ClientAccountType): Promise<void> {
  await AsyncStorage.setItem(CLIENT_ACCOUNT_TYPE_KEY, type);
}

export async function getClientAccountType(): Promise<ClientAccountType | null> {
  const raw = await AsyncStorage.getItem(CLIENT_ACCOUNT_TYPE_KEY);
  if (raw === 'individual' || raw === 'company') return raw;
  return null;
}

export async function isCompanyClientAccount(): Promise<boolean> {
  return (await getClientAccountType()) === 'company';
}

export async function clearClientAccountType(): Promise<void> {
  await AsyncStorage.removeItem(CLIENT_ACCOUNT_TYPE_KEY);
}
