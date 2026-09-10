import { isConversationClosedError, MESSAGING_CLOSED } from '@/utils/conversationAccess';

/**
 * The server closes a job's conversation to new messages an hour after the job
 * is completed, and says so with one code on a send. Reading never closes.
 */
describe('recognising a closed conversation', () => {
  it('reads the code the server sends for it', () => {
    expect(isConversationClosedError({ status: 403, code: MESSAGING_CLOSED })).toBe(true);
  });

  it('is not thrown by casing or padding the app does not control', () => {
    expect(isConversationClosedError({ code: 'messaging_closed' })).toBe(true);
    expect(isConversationClosedError({ code: ' MESSAGING_CLOSED ' })).toBe(true);
  });

  /**
   * The regression this file exists to stop.
   *
   * These were all read as "closed" before, and the first two are exactly what
   * a provider got back when loading an active job's messages. That was a real
   * access failure - the closing rule did not exist yet - and treating it as
   * closed told people a conversation had ended when it had not, and hid the
   * bug while it did. A refusal without the code is an error, full stop.
   */
  it('does not read a bare refusal as closed', () => {
    expect(isConversationClosedError({ status: 403 })).toBe(false);
    expect(isConversationClosedError({ status: 403, message: 'You do not have access to that.' })).toBe(false);
    expect(isConversationClosedError({ message: 'Forbidden' })).toBe(false);
    expect(isConversationClosedError({ code: 'NOT_A_PARTICIPANT' })).toBe(false);
  });

  /** A signed-out session is a session problem, handled as one elsewhere. */
  it('does not read a signed-out session as closed', () => {
    expect(isConversationClosedError({ status: 401 })).toBe(false);
    expect(isConversationClosedError({ status: 401, message: 'Unauthenticated' })).toBe(false);
  });

  it('does not read an outage or a timeout as closed', () => {
    expect(isConversationClosedError({ status: 500, message: 'Internal server error' })).toBe(false);
    expect(isConversationClosedError({ message: 'Network request failed' })).toBe(false);
    expect(isConversationClosedError({ status: 404 })).toBe(false);
  });

  it('survives nothing at all', () => {
    expect(isConversationClosedError(null)).toBe(false);
    expect(isConversationClosedError(undefined)).toBe(false);
    expect(isConversationClosedError({})).toBe(false);
    expect(isConversationClosedError({ code: 403 })).toBe(false);
  });
});
