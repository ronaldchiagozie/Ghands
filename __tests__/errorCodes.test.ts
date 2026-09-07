/**
 * Error codes replace English pattern-matching in the money flows.
 *
 * The backend sends a stable `code` now, but not from every endpoint yet, and
 * its error envelope is less consistent than its success one - so the code is
 * looked for at each nesting level and the text match survives as a fallback.
 */
import { extractErrorCode } from '@/services/api/client';

describe('extractErrorCode', () => {
  it('finds the code at each nesting level the API has used', () => {
    expect(extractErrorCode({ code: 'PIN_INVALID' })).toBe('PIN_INVALID');
    expect(extractErrorCode({ data: { code: 'INSUFFICIENT_BALANCE' } })).toBe('INSUFFICIENT_BALANCE');
    expect(extractErrorCode({ error: { code: 'PIN_NOT_SET' } })).toBe('PIN_NOT_SET');
    expect(extractErrorCode({ data: { error: { code: 'BANK_ACCOUNT_INVALID' } } })).toBe(
      'BANK_ACCOUNT_INVALID',
    );
  });

  /** An endpoint that has not been updated yet must fall through to the text match. */
  it('returns undefined when there is no code', () => {
    expect(extractErrorCode({ message: 'Invalid PIN' })).toBeUndefined();
    expect(extractErrorCode({ data: { error: 'Insufficient balance' } })).toBeUndefined();
    expect(extractErrorCode(null)).toBeUndefined();
    expect(extractErrorCode(undefined)).toBeUndefined();
    expect(extractErrorCode('not an object')).toBeUndefined();
  });

  /** A non-string or blank code must not be mistaken for a real one. */
  it('ignores a code that is not usable', () => {
    expect(extractErrorCode({ code: '' })).toBeUndefined();
    expect(extractErrorCode({ code: '   ' })).toBeUndefined();
    expect(extractErrorCode({ code: 500 })).toBeUndefined();
    expect(extractErrorCode({ code: { nested: true } })).toBeUndefined();
  });

  /** Falls back to the next level rather than giving up on the first miss. */
  it('skips an unusable code in favour of a real one deeper down', () => {
    expect(extractErrorCode({ code: '', data: { code: 'PIN_INVALID' } })).toBe('PIN_INVALID');
  });
});

/**
 * The classification the payment screen performs. The old rule matched the bare
 * word "balance", so an error about *reading* the balance was shown as
 * "Insufficient wallet balance - top up", pointing someone at a payment they
 * may not have needed to make.
 */
describe('insufficient-balance classification', () => {
  const classify = (code: string | undefined, message: string) =>
    code === 'INSUFFICIENT_BALANCE' || (!code && /insufficient/i.test(message));

  it('trusts the code when there is one', () => {
    expect(classify('INSUFFICIENT_BALANCE', 'anything at all')).toBe(true);
    expect(classify('PIN_INVALID', 'insufficient balance')).toBe(false);
  });

  it('no longer treats any mention of "balance" as insufficient funds', () => {
    expect(classify(undefined, 'Could not verify your balance. Please try again.')).toBe(false);
    expect(classify(undefined, 'Balance service unavailable')).toBe(false);
  });

  it('still catches a genuine one from an endpoint with no code yet', () => {
    expect(classify(undefined, 'Insufficient balance')).toBe(true);
    expect(classify(undefined, 'You have insufficient funds')).toBe(true);
  });
});
