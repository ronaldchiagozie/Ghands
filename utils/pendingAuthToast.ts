/**
 * A session-expiry redirect happens outside any one screen's component tree
 * (root layout effects, the global promise-rejection handler), so there is no
 * `useToast()` instance to call. This hands the message to whichever screen
 * the redirect lands on - LoginScreen consumes it once on mount.
 */
let pendingMessage: string | null = null;

export function setPendingAuthToast(message: string): void {
  pendingMessage = message;
}

/** Reads and clears the message - a second consumer gets nothing. */
export function consumePendingAuthToast(): string | null {
  const message = pendingMessage;
  pendingMessage = null;
  return message;
}
