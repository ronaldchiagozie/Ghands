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

describe('gender is part of a complete profile', () => {
  /**
   * ProfileCompletionModal refuses to submit without name, phone AND gender.
   * The check used to look at only name and phone, so an account missing gender
   * counted as complete — the setup checklist hid the task while the form still
   * demanded it. These must not drift apart again.
   */
  it('rejects a profile with no gender when gender is known', () => {
    expect(isProfileDetailsComplete('Bendee Ok', '08129381869', '')).toBe(false);
    expect(isProfileDetailsComplete('Bendee Ok', '08129381869', '   ')).toBe(false);
  });

  it('accepts a profile with all three', () => {
    expect(isProfileDetailsComplete('Bendee Ok', '08129381869', 'male')).toBe(true);
  });

  it('still enforces name and phone regardless of gender', () => {
    expect(isProfileDetailsComplete('Bo', '08129381869', 'male')).toBe(false);
    expect(isProfileDetailsComplete('Bendee Ok', '123', 'male')).toBe(false);
  });

  it('leaves two-argument callers unchanged', () => {
    expect(isProfileDetailsComplete('Bendee Ok', '08129381869')).toBe(true);
  });
});
