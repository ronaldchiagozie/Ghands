import { mapApiProfileToUserProfile } from '@/hooks/useProfile';

describe('mapApiProfileToUserProfile', () => {
  it('maps nested success.data.data user profile shape', () => {
    const raw = {
      success: true,
      message: 'Success',
      data: {
        data: {
          type: 'user',
          id: 12,
          firstName: 'Ronald',
          lastName: 'Bendee',
          userName: 'gronaldchiatest5',
          email: 'gronaldchia+test5@gmail.com',
          phoneNumber: '08129351266',
          gender: 'male',
        },
      },
    };

    expect(mapApiProfileToUserProfile(raw)).toEqual({
      name: 'Ronald Bendee',
      email: 'gronaldchia+test5@gmail.com',
      phone: '08129351266',
      profileImageUri: undefined,
    });
  });

  it('maps shape returned after extractResponseData (single data wrapper)', () => {
    const raw = {
      data: {
        type: 'user',
        id: 12,
        firstName: 'Ronald',
        lastName: 'Bendee',
        email: 'a@b.com',
        phoneNumber: '08129351266',
      },
    };

    expect(mapApiProfileToUserProfile(raw).name).toBe('Ronald Bendee');
  });
});
