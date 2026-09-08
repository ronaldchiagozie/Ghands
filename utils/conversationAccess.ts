/**
 * Telling a closed conversation apart from a broken one.
 *
 * The server refuses access to a job's messages once the job is over. That is
 * a rule, not a fault - the thread belongs to a piece of work, and the work
 * has finished. The app was treating it as an error: it logged "You do not
 * have access to that" on a loop, showed an empty thread, and left a text box
 * that looked ready and failed on every send.
 *
 * The refusal is the most reliable signal there is about whether the
 * conversation is open, because it is the same system that would accept the
 * message. Better to read it than to infer the answer from a job status the
 * app may have fetched minutes ago.
 */

/** Phrases the server uses for this. Matched loosely; the wording is not ours. */
const ACCESS_PHRASES = [
  'do not have access',
  "don't have access",
  'no access',
  'not a participant',
  'not authorized',
  'not authorised',
  'forbidden',
];

export function isConversationClosedError(error: unknown): boolean {
  const err = error as { status?: number; message?: string; code?: string } | null | undefined;
  if (!err) return false;

  /**
   * 403 is the whole answer when it arrives. It means the server knows who is
   * asking and is declining anyway, which for this endpoint means the thread
   * is closed rather than that somebody is signed out - a 401 would say that,
   * and is handled elsewhere as a session problem.
   */
  if (err.status === 403) return true;

  /**
   * Underscores flattened to spaces, because the two places this arrives from
   * are written differently: a human-readable message says "not a
   * participant" and a machine code says NOT_A_PARTICIPANT. One list should
   * match both.
   */
  const text = `${err.message ?? ''} ${err.code ?? ''}`.toLowerCase().replace(/_/g, ' ');
  return ACCESS_PHRASES.some((phrase) => text.includes(phrase));
}
