/**
 * Whether the server has closed a job's conversation to new messages.
 *
 * There is exactly one signal for it: a send refused with MESSAGING_CLOSED.
 * The server allows messages and calls for an hour after a job is completed -
 * room for a forgotten key or a question about the receipt - and then stops
 * accepting them. Reading is never closed: the thread stays available as a
 * record of what was agreed, indefinitely.
 *
 * This used to read any 403, and a handful of phrases such as "You do not
 * have access to that", as closed. That was wrong, and it did damage. The
 * refusal it was built around turned out to be a real access failure on
 * reading messages, not a closing rule - the rule did not exist yet - so the
 * app was telling people a conversation had ended on jobs that had not ended,
 * and hiding a genuine bug while it did. A read that fails is an error and is
 * shown as one; only the code the server sends for this, on a send, means
 * closed.
 */

export const MESSAGING_CLOSED = 'MESSAGING_CLOSED';

export function isConversationClosedError(error: unknown): boolean {
  const err = error as { code?: unknown } | null | undefined;
  if (!err || typeof err.code !== 'string') return false;
  return err.code.trim().toUpperCase() === MESSAGING_CLOSED;
}
