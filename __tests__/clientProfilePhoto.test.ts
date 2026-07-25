import {
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

  it('summarizes which image keys exist', () => {
    const fields = summarizeProfileImageFields({ profileImage: 'file:///local.jpg' });
    expect(fields.profileImage).toBe('file:///local.jpg');
  });
});
