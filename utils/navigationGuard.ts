/**
 * Stops one tap becoming three screens.
 *
 * Neither app guarded navigation: every `router.push` fired on every tap,
 * across 134 call sites in the provider app alone. A screen that waits on
 * the network before it draws looks frozen, so the natural thing is to tap
 * again - and each of those taps was honoured. Hence the reported
 * behaviour: nothing happens, you tap three or four times, and the app
 * walks through three or four copies of the same screen.
 *
 * The lock is global rather than per-component, because the duplicates are
 * usually not one button pressed twice; they are a tap landing on the
 * button, and then on whatever ends up under the finger once the next
 * screen mounts.
 */

/** Long enough to cover a screen transition, short enough not to eat a real second tap. */
const GUARD_MS = 700;

let lockedUntil = 0;

/**
 * How deep we are inside a navigation that has already been claimed.
 *
 * Re-entrancy matters because the two layers overlap: a helper like
 * navigateBack claims the lock and then calls `router.back()`, and that
 * router is itself guarded. Without this the inner call would be refused
 * and the navigation would be swallowed entirely - a guard that blocks the
 * very thing it was asked to protect. Anything nested inside an
 * already-claimed move is part of that move, so it passes.
 */
let depth = 0;

/**
 * True when this navigation should proceed, and takes the lock if so.
 *
 * `false` means "already handled" - never an error, and never worth
 * reporting. Swallowing the duplicate is the entire point.
 */
export function claimNavigation(): boolean {
  if (depth > 0) return true;
  const now = Date.now();
  if (now < lockedUntil) return false;
  lockedUntil = now + GUARD_MS;
  return true;
}

/**
 * Runs `navigate` unless a navigation was already claimed a moment ago,
 * holding the re-entrancy flag for the duration so nested moves pass.
 */
export function runGuardedNavigation(navigate: () => void): void {
  if (!claimNavigation()) return;
  depth += 1;
  try {
    navigate();
  } finally {
    depth -= 1;
  }
}

/** Kept for call sites that only need the boolean form. */
export function guardedNavigate(navigate: () => void): void {
  runGuardedNavigation(navigate);
}

/**
 * Releases the lock early.
 *
 * For a handler that claimed one and then decided not to go anywhere - a
 * validation failure, say - and for tests, which fire navigations back to
 * back with no real clock between them.
 */
export function releaseNavigationLock(): void {
  lockedUntil = 0;
  depth = 0;
}
