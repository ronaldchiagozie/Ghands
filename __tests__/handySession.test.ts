/**
 * Reopening the Handy conversation somebody was in.
 *
 * Leaving the screen and coming back used to start from the greeting and the
 * quick-action cards, with no sign that the thread you were halfway through
 * still existed. It did, in the history drawer, but you had to know to go and
 * look, and most people would simply start again and repeat themselves to an
 * assistant that had already been told.
 */
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
  setItem: jest.fn(async (k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete store[k];
  }),
}));

import {
  clearHandySession,
  HANDY_SESSION_TTL_MS,
  readHandySession,
  rememberHandySession,
} from '@/utils/handySession';

const KEY = '@ghands:handy_last_session';

describe('the Handy session', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('reopens the conversation last used', async () => {
    await rememberHandySession(42);
    await expect(readHandySession()).resolves.toBe(42);
  });

  it('moves on when a different conversation is opened', async () => {
    await rememberHandySession(42);
    await rememberHandySession(77);
    await expect(readHandySession()).resolves.toBe(77);
  });

  /**
   * Ten hours. Long enough that stepping away for the afternoon lands you where
   * you were; short enough that yesterday's problem does not reappear as though
   * it were today's.
   */
  it('forgets a conversation older than the window', async () => {
    await rememberHandySession(42);
    const stored = JSON.parse(store[KEY]);
    stored.lastActiveAt = Date.now() - HANDY_SESSION_TTL_MS - 60_000;
    store[KEY] = JSON.stringify(stored);

    await expect(readHandySession()).resolves.toBeNull();
  });

  it('keeps one still inside the window', async () => {
    await rememberHandySession(42);
    const stored = JSON.parse(store[KEY]);
    stored.lastActiveAt = Date.now() - (HANDY_SESSION_TTL_MS - 60_000);
    store[KEY] = JSON.stringify(stored);

    await expect(readHandySession()).resolves.toBe(42);
  });

  it('forgets it when a new chat is started', async () => {
    await rememberHandySession(42);
    await clearHandySession();
    await expect(readHandySession()).resolves.toBeNull();
  });

  it('records nothing for a conversation that has no id yet', async () => {
    await rememberHandySession(null);
    await rememberHandySession(undefined);
    await rememberHandySession(0);
    await rememberHandySession(NaN);
    await expect(readHandySession()).resolves.toBeNull();
  });

  /** Never navigate somewhere undefined on the strength of bad stored data. */
  it('treats anything malformed as nothing to reopen', async () => {
    for (const raw of [
      'not json',
      '{}',
      JSON.stringify({ conversationId: 42 }),
      JSON.stringify({ lastActiveAt: Date.now() }),
      JSON.stringify({ conversationId: 'forty-two', lastActiveAt: Date.now() }),
      JSON.stringify({ conversationId: 42, lastActiveAt: 'yesterday' }),
      JSON.stringify(null),
    ]) {
      store[KEY] = raw;
      await expect(readHandySession()).resolves.toBeNull();
    }
  });
});
