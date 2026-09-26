import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAccountStorage, clearAllAppStorage } from '@/utils/accountStorage';

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['@app:onboarding_complete', 'true'],
    ['@ghands:user_role', 'client'],
    ['@ghands:push_token', 'ExponentPushToken[x]'],
    ['@ghands:user_id', '42'],
    ['@ghands:provider_verified', 'true'],
    ['@ghands:booking_resume', '{"requestId":9}'],
    ['@ghands:chat_messages:9', '[]'],
    ['@app:user_location', '{"lat":6.5}'],
  ]);
});

describe('signing out', () => {
  it("leaves nothing of the account for the next person to inherit", async () => {
    await clearAccountStorage();
    const left = await AsyncStorage.getAllKeys();
    for (const key of ['@ghands:user_id', '@ghands:provider_verified', '@ghands:booking_resume', '@ghands:chat_messages:9', '@app:user_location']) {
      expect(left).not.toContain(key);
    }
  });

  it('keeps what belongs to the phone, so it opens on sign-in and not the tour', async () => {
    await clearAccountStorage();
    expect(await AsyncStorage.getItem('@app:onboarding_complete')).toBe('true');
    expect(await AsyncStorage.getItem('@ghands:user_role')).toBe('client');
    expect(await AsyncStorage.getItem('@ghands:push_token')).toBe('ExponentPushToken[x]');
  });
});

describe('resetting onboarding', () => {
  it('leaves the app as a fresh install would find it', async () => {
    await clearAllAppStorage();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
