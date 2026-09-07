/**
 * The one thing both notification modules need from each other.
 *
 * It lived in notificationNavigation, which imports walletNotificationCopy for
 * receipt routing, while walletNotificationCopy imported this back — a require
 * cycle that Metro warns about on every boot: "can result in uninitialized
 * values". That is not theoretical here. This app has already shipped one crash
 * from a value being read before it was initialised, and a cycle is the same
 * failure with a less obvious cause, since which module wins depends on which
 * one is imported first.
 *
 * Pulling the shared helper into a leaf module both can import breaks it.
 */
export function normalizeNotificationType(type: unknown): string {
  return String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}
