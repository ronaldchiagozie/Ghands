import {
  isDisplayableAvatarUri,
  pickProfileImageUriFromApi,
  summarizeProfileImageFields,
} from '@/utils/clientProfilePhoto';

describe('clientProfilePhoto', () => {
  it('reads avatar from nested profile payload', () => {
    const raw = {
      data: {
        firstName: 'Jane',
        avatar: 'https://cdn.example.com/a.jpg',
      },
    };
    expect(pickProfileImageUriFromApi(raw)).toBe('https://cdn.example.com/a.jpg');
  });

  it('ignores generic image field that is not a profile avatar key', () => {
    expect(
      pickProfileImageUriFromApi({ image: 'https://cdn.example.com/banner.jpg' }),
    ).toBeUndefined();
  });

  it('accepts local file URIs for profile picks', () => {
    expect(pickProfileImageUriFromApi({ profileImage: 'file:///local.jpg' })).toBe(
      'file:///local.jpg',
    );
  });

  it('summarizes which image keys exist', () => {
    const fields = summarizeProfileImageFields({ profileImage: 'file:///local.jpg' });
    expect(fields.profileImage).toBe('file:///local.jpg');
  });
});
