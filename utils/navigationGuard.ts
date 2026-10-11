/**
 * Stops one tap becoming two screens.
 *
 * Neither app had any guard on navigation: every `router.push` fired on
 * every tap, and a screen that waits on the network before it draws looks
 * frozen - so the natural thing to do is tap again, and again. Each of
 * those taps was honoured. The result is the reported behaviour exactly:
 * nothing happens, you tap three or four times, and then the app walks
 * through three or four copies of the same screen.
 *
 * The lock is global rather than per-component because the duplicates are
 * usually not one button pressed twice; they are a tap landing on the
 * button, and then on whatever ends up under the finger once the next
 * screen mounts.
 */

/** Long enough to cover a screen transition, short enough not to eat a real second tap. */
const GUARD_MS = 700;

let lockedUntil = 0;

/**
 * True when this navigation should proceed, and takes the lock if so.
 *
 * Callers that need to know treat `false` as "already handled" - not as an
 * error, and never as something to report. A swallowed duplicate is the
 * whole point.
 */
export function claimNavigation(): boolean {
  const now = Date.now();
  if (now < lockedUntil) return false;
  lockedUntil = now + GUARD_MS;
  return true;
}

/**
 * Runs `navigate` unless a navigation was already claimed a moment ago.
 *
 * Wrapping rather than returning a boolean keeps call sites to one line and
 * makes it hard to take the lock and then forget to navigate.
 */
export function guardedNavigate(navigate: () => void): void {
  if (!claimNavigation()) return;
  navigate();
}

/**
 * Releases the lock early.
 *
 * For a handler that claimed one and then decided not to go anywhere - a
 * validation failure, say. Without this the person is held for the full
 * window after a tap that did nothing.
 */
export function releaseNavigationLock(): void {
  lockedUntil = 0;
}
