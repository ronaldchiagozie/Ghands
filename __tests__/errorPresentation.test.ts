import { describe, expect, it } from '@jest/globals';
import { presentError } from '@/utils/errorPresentation';
import { AuthError } from '@/utils/errors';

describe('presentError — what the user is told, and what the button does', () => {
  it('offers sign-in, not retry, when the session has expired', () => {
    const p = presentError(new AuthError('Your session has expired. Please sign in again.'));
    expect(p.kind).toBe('session');
    expect(p.action.kind).toBe('signIn');
    expect(p.action.label).toBe('Sign in again');
  });

  it('treats a 401 the same as a thrown AuthError', () => {
    expect(presentError({ status: 401, message: 'Unauthorized' }).action.kind).toBe('signIn');
  });

  it('names the offline case plainly and offers a retry', () => {
    const p = presentError({ message: 'Network request failed' }, 'services');
    expect(p.kind).toBe('offline');
    expect(p.title).toBe("You're offline");
    expect(p.action.kind).toBe('retry');
  });

  it('separates a timeout from a plain offline error', () => {
    const p = presentError({ message: 'Request timed out' }, 'services');
    expect(p.kind).toBe('timeout');
  });

  it('never shows scraped proxy HTML — the "Just a moment..." regression', () => {
    const p = presentError({ message: 'Server error: Just a moment...', status: 503 });
    expect(p.kind).toBe('server');
    expect(p.message).not.toContain('Just a moment');
    expect(p.message).not.toContain('Server error');
    expect(p.title).toBe('Our end is having trouble');
  });

  it('classifies an HTML body as a server problem even without a status', () => {
    expect(presentError({ message: '<!DOCTYPE html><title>502 Bad Gateway</title>' }).kind).toBe('server');
  });

  it('does not offer a pointless retry on a 404', () => {
    const p = presentError({ status: 404 }, 'this booking');
    expect(p.kind).toBe('notFound');
    expect(p.action.kind).toBe('dismiss');
  });

  it('tells a rate-limited user to wait rather than hammer the button', () => {
    const p = presentError({ status: 429 });
    expect(p.kind).toBe('rateLimit');
    expect(p.message).toContain('Wait');
  });

  it('names what failed using the subject it was given', () => {
    expect(presentError({ status: 400, message: 'boom' }, 'your job activity').message).toContain(
      'your job activity',
    );
  });

  it('suppresses a raw status echo behind a real explanation', () => {
    const p = presentError({ message: 'Request failed with status 500', status: 500 });
    expect(p.message).not.toContain('500');
  });
});

describe('presentError — an infrastructure page must not blame the user', () => {
  const suspended = {
    status: 429,
    message: 'The server could not be reached. Please try again in a moment.',
    details: {
      htmlResponse: '<!DOCTYPE html><title>Service Suspended</title>This service has been suspended.',
      scrapedTitle: 'Service Suspended',
    },
  };

  it('reads a suspended backend as our outage, not the user rate-limiting themselves', () => {
    const p = presentError(suspended, 'services');
    expect(p.kind).toBe('server');
    expect(p.title).toBe('Our end is having trouble');
    expect(p.message).not.toContain('a lot of requests');
  });

  it('still rate-limits when the API itself answers with 429', () => {
    expect(presentError({ status: 429, message: 'Too many requests' }).kind).toBe('rateLimit');
  });

  it('never leaks the host holding page to the user', () => {
    const p = presentError(suspended);
    expect(p.message).not.toContain('suspended');
    expect(p.message).not.toContain('DOCTYPE');
  });
});

describe('presentError — an absent message is not evidence of anything', () => {
  it('does not read a status-only 404 as a server outage', () => {
    expect(presentError({ status: 404 }).kind).toBe('notFound');
  });

  it('does not read a status-only 429 as a server outage', () => {
    expect(presentError({ status: 429 }).kind).toBe('rateLimit');
  });

  it('falls back to unknown when there is neither status nor message', () => {
    expect(presentError({}).kind).toBe('unknown');
  });
});
