/**
 * Two reads of the auth token at the same moment must not lose it.
 *
 * getSecureItem migrates a legacy AsyncStorage value into SecureStore and then
 * deletes the old copy. That is only safe once. Several screens load together
 * on every tab, so the reads interleaved:
 *
 *   A: SecureStore empty, reads legacy, writes it across, deletes the legacy copy
 *   B: SecureStore read already returned empty, falls back to legacy, finds
 *      nothing because A just deleted it, and reports no token
 *
 * A missing token is treated as a dead session, so B signed the person out
 * while A was holding the token they were signed out for.
 */
const mockSecureStore = new Map<string, string>();
const mockAsyncStore = new Map<string, string>();

const mockTick = () => new Promise<void>((r) => setImmediate(r));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => {
    await mockTick();
    return mockSecureStore.has(k) ? mockSecureStore.get(k)! : null;
  }),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    await mockTick();
    mockSecureStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockSecureStore.delete(k);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => {
    await mockTick();
    return mockAsyncStore.has(k) ? mockAsyncStore.get(k)! : null;
  }),
  setItem: jest.fn(async (k: string, v: string) => {
    mockAsyncStore.set(k, v);
  }),
  removeItem: jest.fn(async (k: string) => {
    mockAsyncStore.delete(k);
  }),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { getSecureItem } from '@/utils/secureStorage';

const KEY = '@ghands:auth_token';
const TOKEN = 'b89eeda9-9c1e-440f-a4f7-0ad4b19969fb';

describe('reading the auth token', () => {
  beforeEach(() => {
    mockSecureStore.clear();
    mockAsyncStore.clear();
  });

  it('gives simultaneous readers the token during a legacy migration', async () => {
    mockAsyncStore.set(KEY, TOKEN);

    const results = await Promise.all([
      getSecureItem(KEY),
      getSecureItem(KEY),
      getSecureItem(KEY),
    ]);

    expect(results).toEqual([TOKEN, TOKEN, TOKEN]);
  });

  /**
   * The reported bug, and the case that actually fails without the fix.
   *
   * Screens do not mount in lockstep. Perfectly simultaneous readers happen to
   * survive the old code, because they both read the legacy value before either
   * deletes it. A reader starting one tick later is the one that loses: the
   * first has already migrated and removed the legacy copy, so the second finds
   * nothing and reports a dead session.
   */
  it('gives a slightly later reader the token too', async () => {
    mockAsyncStore.set(KEY, TOKEN);

    const first = getSecureItem(KEY);
    await mockTick();
    const second = getSecureItem(KEY);

    await expect(first).resolves.toBe(TOKEN);
    await expect(second).resolves.toBe(TOKEN);
  });

  /** Three screens, each a tick apart, which is what a tab load looks like. */
  it('survives a staggered burst', async () => {
    mockAsyncStore.set(KEY, TOKEN);

    const reads: Promise<string | null>[] = [];
    for (let i = 0; i < 3; i += 1) {
      reads.push(getSecureItem(KEY));
      await mockTick();
    }

    expect(await Promise.all(reads)).toEqual([TOKEN, TOKEN, TOKEN]);
  });

  it('migrates the value into secure storage exactly once', async () => {
    mockAsyncStore.set(KEY, TOKEN);
    await Promise.all([getSecureItem(KEY), getSecureItem(KEY)]);

    expect(mockSecureStore.get('ghands.secure.auth_token')).toBe(TOKEN);
    expect(mockAsyncStore.has(KEY)).toBe(false);
  });

  it('still reads a value already in secure storage', async () => {
    mockSecureStore.set('ghands.secure.auth_token', TOKEN);
    await expect(getSecureItem(KEY)).resolves.toBe(TOKEN);
  });

  /** Genuinely absent is still absent; the fix must not invent a token. */
  it('returns null when there is nothing stored anywhere', async () => {
    await expect(getSecureItem(KEY)).resolves.toBeNull();
    const results = await Promise.all([getSecureItem(KEY), getSecureItem(KEY)]);
    expect(results).toEqual([null, null]);
  });

  /** A later read must not be served a stale shared promise. */
  it('reads again once the first read has settled', async () => {
    await expect(getSecureItem(KEY)).resolves.toBeNull();

    mockSecureStore.set('ghands.secure.auth_token', TOKEN);
    await expect(getSecureItem(KEY)).resolves.toBe(TOKEN);
  });
});
