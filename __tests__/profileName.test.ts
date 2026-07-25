import { deriveUserName, splitFullName } from '@/utils/profileName';

describe('profileName', () => {
  it('splits full name into first and last', () => {
    expect(splitFullName('John Doe')).toEqual({ firstName: 'John', lastName: 'Doe' });
  });

  it('uses single name for both parts when only one word', () => {
    expect(splitFullName('Madonna')).toEqual({ firstName: 'Madonna', lastName: 'Madonna' });
  });

  it('derives userName from email', () => {
    expect(deriveUserName('John Doe', 'johndoe@gmail.com')).toBe('johndoe');
  });
});
