import { isAuthError } from './errors';
import { isConnectivityOrNetworkError } from './isNetworkFailure';

/** What the primary button actually does — chosen from the cause, never a blanket retry. */
export type ErrorRecoveryKind = 'retry' | 'signIn' | 'dismiss';

export type ErrorKind =
  | 'offline'
  | 'timeout'
  | 'server'
  | 'session'
  | 'rateLimit'
  | 'notFound'
  | 'unknown';

export type ErrorPresentation = {
  kind: ErrorKind;
  /** Short category shown above the title — names the class of problem at a glance. */
  label: string;
  title: string;
  /** Plain language: what happened, and what it means for the user. */
  message: string;
  action: { label: string; kind: ErrorRecoveryKind };
  /** Tone of the sheet icon — semantic, not decorative. */
  tone: 'error' | 'warning' | 'neutral';
  /** Raw technical text, surfaced in __DEV__ only. Never shown in production. */
  debugMessage?: string;
};

/**
 * Text we must never put in front of a user: scraped HTML titles from a proxy
 * (Cloudflare's "Just a moment..."), stack-ish fragments, and status echoes.
 */
function looksTechnical(raw: string): boolean {
  const m = raw.toLowerCase().trim();
  if (!m) return true;
  return (
    m.startsWith('server error:') ||
    m.startsWith('<') ||
    m.includes('<!doctype') ||
    m.includes('just a moment') ||
    m.includes('cloudflare') ||
    m.includes('request failed with status') ||
    m.includes('internal server error') ||
    m.includes('bad gateway') ||
    m.includes('service unavailable') ||
    m.includes('gateway timeout') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('undefined is not') ||
    m.includes('cannot read propert')
  );
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; response?: { status?: number } } | null;
  const status = e?.status ?? e?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * True when an HTML page answered instead of the API — a host holding page, a
 * CDN challenge, a suspended-service notice. The status on those pages describes
 * the proxy, not the request, so it must not drive the message: a suspended
 * backend once returned 429 and the user was told they had made too many
 * requests, which blamed them for our outage.
 */
function cameFromInfrastructure(error: unknown): boolean {
  const details = (error as { details?: { htmlResponse?: unknown } } | null)?.details;
  return typeof details?.htmlResponse === 'string' && details.htmlResponse.length > 0;
}

function rawMessageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  const e = error as { message?: string } | null;
  return String(e?.message ?? '');
}

/**
 * Turns any thrown value into something a person can act on.
 *
 * `subject` names what failed in the user's words ("services", "your job activity")
 * so the sheet explains the actual situation instead of "an error occurred".
 */
export function presentError(
  error: unknown,
  subject: string = 'this'
): ErrorPresentation {
  const raw = rawMessageOf(error);
  const status = statusOf(error);
  const lower = raw.toLowerCase();
  // In dev, the proxy's own title ("Service Suspended", "502 Bad Gateway") is the
  // single most useful clue about what actually broke.
  const scraped = (error as { details?: { scrapedTitle?: unknown } } | null)?.details?.scrapedTitle;
  const debugMessage = __DEV__
    ? [typeof scraped === 'string' ? scraped : '', raw].filter(Boolean).join(' · ') || undefined
    : undefined;

  // Session first — a signed-out user cannot retry their way out of it.
  if (isAuthError(error) || status === 401 || status === 403) {
    return {
      kind: 'session',
      label: 'Session',
      tone: 'warning',
      title: "You've been signed out",
      message: 'Your session expired for security. Sign in again to pick up where you left off.',
      action: { label: 'Sign in again', kind: 'signIn' },
      debugMessage,
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out') || status === 408) {
    return {
      kind: 'timeout',
      label: 'Connection',
      tone: 'warning',
      title: 'That took too long',
      message: `The connection dropped before ${subject} finished loading. This usually clears on a second try.`,
      action: { label: 'Try again', kind: 'retry' },
      debugMessage,
    };
  }

  if (isConnectivityOrNetworkError(error)) {
    return {
      kind: 'offline',
      label: 'Connection',
      tone: 'warning',
      title: "You're offline",
      message: `Your device isn't connected right now. Reconnect to Wi-Fi or mobile data, then load ${subject} again.`,
      action: { label: 'Try again', kind: 'retry' },
      debugMessage,
    };
  }

  // Anything 5xx, or a page that never reached the API, is our problem — checked
  // before the status-specific branches so a proxy's code cannot mislead.
  const hasJunkText = raw.trim() !== '' && looksTechnical(raw);
  if (cameFromInfrastructure(error) || (status !== undefined && status >= 500) || hasJunkText) {
    return {
      kind: 'server',
      label: 'Service',
      tone: 'error',
      title: 'Our end is having trouble',
      message:
        "This one is on us — our server couldn't answer just now. Nothing you did caused it, and nothing was lost. Give it a few seconds and try again.",
      action: { label: 'Try again', kind: 'retry' },
      debugMessage,
    };
  }

  if (status === 429) {
    return {
      kind: 'rateLimit',
      label: 'Rate limit',
      tone: 'warning',
      title: 'Slow down a moment',
      message: "You've made a lot of requests in a short time. Wait about a minute, then try again.",
      action: { label: 'Try again', kind: 'retry' },
      debugMessage,
    };
  }

  if (status === 404) {
    return {
      kind: 'notFound',
      label: 'Not found',
      tone: 'neutral',
      title: "We couldn't find that",
      message: `${subject.charAt(0).toUpperCase()}${subject.slice(1)} is no longer available. It may have been cancelled or removed.`,
      action: { label: 'Close', kind: 'dismiss' },
      debugMessage,
    };
  }

  return {
    kind: 'unknown',
    label: 'Unexpected',
    tone: 'error',
    title: "That didn't load",
    message: `We couldn't load ${subject}. Try again — if it keeps happening, reach us from Help & support.`,
    action: { label: 'Try again', kind: 'retry' },
    debugMessage,
  };
}
