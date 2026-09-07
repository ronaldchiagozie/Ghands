/**
 * Two different problems that were being reported with the same sentence.
 *
 * The screen said "You're offline. Check your connection and try again." — but
 * the latch that raises it deliberately returns early when the device link is
 * down, because NetInfo already covers that case. So it only ever appeared when
 * the person's connection was working and our server had not answered, and it
 * told them to go and fix something that was not broken.
 */
import { deriveOnlineFromNetInfo } from '@/utils/connectivityCheck';

/** The rule the provider applies, extracted. */
function reasonFor(linkUp: boolean, apiUnreachable: boolean): 'device' | 'server' | null {
  const online = linkUp && !apiUnreachable;
  if (online) return null;
  return linkUp ? 'server' : 'device';
}

describe('why the app thinks it is offline', () => {
  it('blames the server when the device link is up', () => {
    expect(reasonFor(true, true)).toBe('server');
  });

  it('blames the connection when the link is actually down', () => {
    expect(reasonFor(false, false)).toBe('device');
    expect(reasonFor(false, true)).toBe('device');
  });

  it('is nothing at all when both are fine', () => {
    expect(reasonFor(true, false)).toBeNull();
  });
});

/**
 * NetInfo reports `isInternetReachable: null` until its own probe finishes, and
 * treating that as offline flashes the screen during startup.
 */
describe('deriveOnlineFromNetInfo', () => {
  it('only calls it offline when isConnected is explicitly false', () => {
    expect(deriveOnlineFromNetInfo({ isConnected: false } as any)).toBe(false);
    expect(deriveOnlineFromNetInfo({ isConnected: true } as any)).toBe(true);
  });

  it('assumes online while the state is still unknown', () => {
    expect(deriveOnlineFromNetInfo(null)).toBe(true);
    expect(deriveOnlineFromNetInfo(undefined)).toBe(true);
    expect(deriveOnlineFromNetInfo({} as any)).toBe(true);
    expect(deriveOnlineFromNetInfo({ isConnected: null } as any)).toBe(true);
  });

  /** A reachability probe that has not finished is not evidence of being offline. */
  it('ignores an unconfirmed isInternetReachable', () => {
    expect(deriveOnlineFromNetInfo({ isConnected: true, isInternetReachable: null } as any)).toBe(true);
    expect(deriveOnlineFromNetInfo({ isConnected: true, isInternetReachable: false } as any)).toBe(true);
  });
});
