import { isConversationClosedError } from '@/utils/conversationAccess';

/**
 * The server closes a job's conversation when the job ends. The app used to
 * treat that as a failure: an error on a loop, an empty thread, and a text box
 * that looked ready and failed on every send.
 */
describe('recognising a closed conversation', () => {
  it('reads a 403 as closed', () => {
    expect(isConversationClosedError({ status: 403 })).toBe(true);
  });

  it('reads the message the server actually sends', () => {
    expect(isConversationClosedError({ message: 'You do not have access to that.' })).toBe(true);
    expect(isConversationClosedError({ message: 'Forbidden' })).toBe(true);
    expect(isConversationClosedError({ code: 'NOT_A_PARTICIPANT' })).toBe(true);
  });

  /**
   * The one that must not be confused with it. A 401 is a session problem and
   * is handled as one - showing "this conversation has ended" to somebody who
   * has actually been signed out would send them looking in the wrong place.
   */
  it('does not read a signed-out session as a closed conversation', () => {
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
  });
});
