import { presentServerError } from '@/utils/errorMessages';

describe('presentServerError', () => {
  /**
   * The message that prompted this: the gateway rejected our credentials, and
   * the raw text would have told the user *they* were not authorized.
   */
  it('does not blame the user for our gateway credentials', () => {
    const raw = 'Withdrawal failed: Kora API Error: You are not authorized to access this resource';
    const shown = presentServerError(raw);
    expect(shown).toBe(
      'This service is temporarily unavailable. Please try again later, or contact support if it continues.',
    );
    expect(shown).not.toMatch(/not authorized/i);
    expect(shown).not.toMatch(/kora/i);
  });

  it('strips internal prefixes but keeps a useful reason', () => {
    expect(presentServerError('Withdrawal failed: Daily limit exceeded')).toMatch(/limit exceeded/i);
    expect(presentServerError('Withdrawal failed: Daily limit exceeded')).not.toMatch(/withdrawal failed/i);
  });

  it.each([
    ['Invalid PIN', /pin is incorrect/i],
    ['Insufficient balance', /insufficient balance/i],
    ['Bank account not found', /bank account/i],
  ])('maps %s to user-facing copy', (raw, expected) => {
    expect(presentServerError(raw)).toMatch(expected);
  });

  it('returns null for text only meaningful to us, so callers use their own copy', () => {
    expect(presentServerError('')).toBeNull();
    expect(presentServerError(null)).toBeNull();
    expect(presentServerError('INTERNAL_SERVER_FAILURE')).toBeNull();
    expect(presentServerError('TypeError: undefined at wallet.service.processWithdrawal')).toBeNull();
  });

  it('capitalizes a plain reason', () => {
    expect(presentServerError('something specific went wrong')).toBe('Something specific went wrong');
  });
});
