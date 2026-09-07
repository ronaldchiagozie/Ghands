/**
 * Storing the refresh token an auth response now carries.
 *
 * Until the backend returned one, refreshAuthToken in the API client could
 * never succeed: it read a refresh token nothing had ever written, found null,
 * and fell through to signing the person out. That was the whole reason a
 * single 401 ended a session with no way back.
 */
import { readRefreshToken } from '@/utils/captureRefreshToken';

describe('readRefreshToken', () => {
  /** This API has returned all three shapes at different times. */
  it('finds the token at every nesting level the API uses', () => {
    expect(readRefreshToken({ refreshToken: 'a' })).toBe('a');
    expect(readRefreshToken({ data: { refreshToken: 'b' } })).toBe('b');
    expect(readRefreshToken({ data: { data: { refreshToken: 'c' } } })).toBe('c');
  });

  /** A deployment without the field is normal, not an error. */
  it('returns null when the response carries none', () => {
    expect(readRefreshToken({ token: 'access-only' })).toBeNull();
    expect(readRefreshToken({ data: { token: 'access-only' } })).toBeNull();
    expect(readRefreshToken(null)).toBeNull();
    expect(readRefreshToken(undefined)).toBeNull();
    expect(readRefreshToken('nonsense')).toBeNull();
  });

  it('ignores a value that is not a usable string', () => {
    expect(readRefreshToken({ refreshToken: '' })).toBeNull();
    expect(readRefreshToken({ refreshToken: '   ' })).toBeNull();
    expect(readRefreshToken({ refreshToken: 12345 })).toBeNull();
    expect(readRefreshToken({ refreshToken: { nested: true } })).toBeNull();
  });

  it('trims what it stores', () => {
    expect(readRefreshToken({ refreshToken: '  spaced  ' })).toBe('spaced');
  });

  it('prefers the outermost when more than one level carries it', () => {
    expect(readRefreshToken({ refreshToken: 'outer', data: { refreshToken: 'inner' } })).toBe('outer');
  });
});
