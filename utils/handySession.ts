import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The Handy conversation to reopen when somebody comes back.
 *
 * Leaving the screen and returning used to start from nothing: the greeting,
 * the quick-action cards, and no sign that the conversation you were halfway
 * through still existed. It did, in the history drawer, but you had to know to
 * go and find it. Most people would just start again and repeat themselves.
 *
 * So the last conversation is remembered and reopened, for as long as it is
 * still the same conversation in any meaningful sense.
 */

const STORAGE_KEY = '@ghands:handy_last_session';

/**
 * Ten hours.
 *
 * Long enough that stepping away for the afternoon, or going to look at a
 * booking and coming back, lands you where you were. Short enough that
 * yesterday's problem does not reappear as though it were today's, which is
 * worse than a blank screen: an assistant that answers a question you have
 * forgotten asking reads as broken rather than helpful.
 */
const SESSION_TTL_MS = 10 * 60 * 60 * 1000;

export type HandySession = {
  conversationId: number;
  lastActiveAt: number;
};

/** Called whenever a conversation is opened or replied to. */
export async function rememberHandySession(conversationId: number | null | undefined): Promise<void> {
  if (typeof conversationId !== 'number' || !Number.isFinite(conversationId) || conversationId <= 0) {
    return;
  }
  try {
    const session: HandySession = { conversationId, lastActiveAt: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* resuming is a convenience, never worth breaking the chat for */
  }
}

/** The conversation to reopen, or null when there is nothing worth reopening. */
export async function readHandySession(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HandySession>;
    const id = parsed?.conversationId;
    const lastActiveAt = parsed?.lastActiveAt;

    if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return null;
    if (typeof lastActiveAt !== 'number' || !Number.isFinite(lastActiveAt)) return null;
    if (Date.now() - lastActiveAt > SESSION_TTL_MS) return null;

    return id;
  } catch {
    return null;
  }
}

/** Called when a new chat is started, or the remembered one is deleted. */
export async function clearHandySession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export { SESSION_TTL_MS as HANDY_SESSION_TTL_MS };
