jest.mock('@/utils/clientAccountType', () => ({
  isCompanyClientAccount: jest.fn(async () => false),
  setClientAccountType: jest.fn(),
}));

import { isCompanyClientAccount } from '@/utils/clientAccountType';
import {
  isProfileDetailsComplete,
  profileCompleteKeyForUser,
  resolveClientProfileComplete,
} from '@/utils/profileCompletion';

describe('profileCompletion', () => {
  it('builds a per-user storage key', () => {
    expect(profileCompleteKeyForUser('42')).toBe('@ghands:profile_complete:42');
    expect(profileCompleteKeyForUser(null)).toBe('@ghands:profile_complete');
  });

  it('detects complete name and phone', () => {
    expect(isProfileDetailsComplete('Bendee Ok', '08129381869')).toBe(true);
    expect(isProfileDetailsComplete('Bo', '08129381869')).toBe(false);
    expect(isProfileDetailsComplete('Bendee', '123')).toBe(false);
  });

  it('skips individual complete-signup gate for company clients', async () => {
    (isCompanyClientAccount as jest.Mock).mockResolvedValueOnce(true);
    await expect(resolveClientProfileComplete()).resolves.toBe(true);
  });
});
