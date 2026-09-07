/**
 * Initials for people with no profile photo.
 *
 * The fallback was plumbericon2.png, so a carpenter with no photo was shown
 * holding a wrench - and so was every customer in the chat list. Initials say
 * something true instead, and let two providers be told apart in a list.
 */
import { getAvatarInitials } from '@/components/AvatarCircle';

describe('getAvatarInitials', () => {
  it('takes the first letter of the first two names', () => {
    expect(getAvatarInitials('Musa Ibrahim')).toBe('MI');
    expect(getAvatarInitials('Chidinma Okonkwo Nwosu')).toBe('CO');
  });

  it('handles a single name', () => {
    expect(getAvatarInitials('Musa')).toBe('M');
  });

  /** Providers append their trade to their business name constantly. */
  it('ignores a trade suffix so the initials stay the person', () => {
    expect(getAvatarInitials('Musa Ibrahim Plumbing Services')).toBe('MI');
    expect(getAvatarInitials('Bright Sparks Ltd')).toBe('BS');
  });

  /** "Mr Musa Ibrahim" should read MI, not MM. */
  it('ignores honorifics', () => {
    expect(getAvatarInitials('Mr Musa Ibrahim')).toBe('MI');
    expect(getAvatarInitials('Engr. Tunde Bakare')).toBe('TB');
    expect(getAvatarInitials('Alhaji Sani Bello')).toBe('SB');
  });

  it('copes with the whitespace and punctuation real records carry', () => {
    expect(getAvatarInitials('  musa   ibrahim  ')).toBe('MI');
    expect(getAvatarInitials('Ade-Ola Balogun')).toBe('AB');
    expect(getAvatarInitials("N'Golo Kante")).toBe('NK');
  });

  /** Falls through to the neutral glyph rather than rendering something odd. */
  it('returns nothing when there is no usable name', () => {
    expect(getAvatarInitials('')).toBe('');
    expect(getAvatarInitials('   ')).toBe('');
    expect(getAvatarInitials(null)).toBe('');
    expect(getAvatarInitials(undefined)).toBe('');
    expect(getAvatarInitials('Mr')).toBe('');
    expect(getAvatarInitials('!!!')).toBe('');
    expect(getAvatarInitials(123 as any)).toBe('');
  });

  it('uppercases whatever it finds', () => {
    expect(getAvatarInitials('musa ibrahim')).toBe('MI');
  });
});
