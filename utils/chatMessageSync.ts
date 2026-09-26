/**
 * Keeping a chat list steady while messages are sent and the thread refreshes.
 * Identical in both apps.
 *
 * A message typed here exists before the server knows about it, under a
 * temporary id. Three things used to go wrong with that:
 * - the refresh every few seconds replaced the whole list with the server's,
 *   so a message still sending (or one that failed) vanished and came back;
 * - if the refresh landed after the server saved it but before the send
 *   returned, it showed twice;
 * - swapping the temporary id for the real one gave the row a new identity,
 *   so it animated in a second time.
 *
 * `clientKey` is the identity a row keeps for its whole life; the list is keyed
 * on it, so confirming a message changes its tick and nothing else.
 */

export type SyncedMessage = {
  id: string;
  clientKey?: string;
  text: string;
  timestamp: string;
  isFromCurrentUser?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

export const TEMP_ID_PREFIX = 'temp-';

/** How far apart a local copy and the server's can be and still be the same message. */
const SAME_MESSAGE_WINDOW_MS = 60_000;

export function rowKeyOf(message: { id: string; clientKey?: string }): string {
  return message.clientKey ?? message.id;
}

function isUnconfirmed(m: SyncedMessage): boolean {
  return m.id.startsWith(TEMP_ID_PREFIX) && (m.status === 'sending' || m.status === 'failed');
}

function time(m: SyncedMessage): number {
  const t = Date.parse(m.timestamp);
  return Number.isFinite(t) ? t : 0;
}

/** The server's copy of a message this device is still waiting on, if it has one. */
function serverCopyOf<T extends SyncedMessage>(local: T, server: T[], taken: Set<string>): T | undefined {
  return server.find(
    (s) =>
      !taken.has(s.id) &&
      s.isFromCurrentUser === true &&
      s.text === local.text &&
      Math.abs(time(s) - time(local)) <= SAME_MESSAGE_WINDOW_MS,
  );
}

/**
 * The thread after a refresh: the server's messages, keeping the row identity
 * of any already on screen, plus this device's unconfirmed ones the server
 * does not have yet.
 */
export function mergeServerMessages<T extends SyncedMessage>(previous: T[], server: T[]): T[] {
  const keyById = new Map(previous.filter((m) => m.clientKey).map((m) => [m.id, m.clientKey!]));
  const taken = new Set<string>();

  const pending: T[] = [];
  for (const local of previous.filter(isUnconfirmed)) {
    const copy = serverCopyOf(local, server, taken);
    if (copy) {
      taken.add(copy.id);
      keyById.set(copy.id, rowKeyOf(local));
    } else {
      pending.push(local);
    }
  }

  const merged = server.map((m) => {
    const clientKey = keyById.get(m.id);
    return clientKey && clientKey !== m.id ? { ...m, clientKey } : m;
  });
  return [...merged, ...pending].sort((a, b) => time(a) - time(b));
}

/**
 * The send came back: the temporary row becomes the server's message under the
 * same row identity - or goes, if a refresh already brought the real one in.
 */
export function confirmSent<T extends SyncedMessage>(previous: T[], tempId: string, sent: T): T[] {
  const temp = previous.find((m) => m.id === tempId);
  const clientKey = temp ? rowKeyOf(temp) : tempId;
  if (previous.some((m) => m.id === sent.id)) {
    return previous
      .filter((m) => m.id !== tempId)
      .map((m) => (m.id === sent.id ? { ...m, clientKey } : m));
  }
  return previous.map((m) => (m.id === tempId ? { ...sent, clientKey } : m));
}
