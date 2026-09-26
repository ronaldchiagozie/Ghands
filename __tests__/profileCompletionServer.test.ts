jest.mock('@/services/api', () => ({
  profileService: { getCurrentUserProfile: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { profileService } from '@/services/api';
import { CLIENT_ACCOUNT_TYPE_KEY } from '@/utils/clientAccountType';
import { resolveProfileCompleteFromServer } from '@/utils/profileCompletion';

const getProfile = profileService.getCurrentUserProfile as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  getProfile.mockReset();
});

describe('whether a signed-in account still has a profile step', () => {
  it('lets a company in without asking for a gender it does not have', async () => {
    getProfile.mockResolvedValue({ data: { companyName: 'Acme Plumbing Ltd', phoneNumber: '08012345678' } });
    await expect(resolveProfileCompleteFromServer()).resolves.toBe(true);
    expect(await AsyncStorage.getItem(CLIENT_ACCOUNT_TYPE_KEY)).toBe('company');
  });

  it('knows a company by its account type too', async () => {
    getProfile.mockResolvedValue({ data: { accountType: 'company' } });
    await expect(resolveProfileCompleteFromServer()).resolves.toBe(true);
  });

  it('still asks an individual with no gender to finish', async () => {
    getProfile.mockResolvedValue({ data: { firstName: 'Ada', lastName: 'Obi', phoneNumber: '08012345678' } });
    await expect(resolveProfileCompleteFromServer()).resolves.toBe(false);
    expect(await AsyncStorage.getItem(CLIENT_ACCOUNT_TYPE_KEY)).toBeNull();
  });

  it('counts an individual with everything as done', async () => {
    getProfile.mockResolvedValue({
      data: { firstName: 'Ada', lastName: 'Obi', phoneNumber: '08012345678', gender: 'female' },
    });
    await expect(resolveProfileCompleteFromServer()).resolves.toBe(true);
  });
});
