import { showErrorSheet } from '@/components/ErrorSheet';
import { useEffect, useRef } from 'react';

/**
 * Screens hold their layout when a load fails; this raises the sheet that
 * explains it and offers the one action that can fix it.
 *
 * Pass the screen's own error state. The sheet only appears when there is
 * nothing to show — a failed refresh over existing content stays silent, since
 * the user can still use the screen.
 */
export function useErrorSheet(options: {
  /** The thrown error, or null when the last load succeeded. */
  error: unknown;
  /** What failed, in the user's words — "your transactions", "this provider". */
  subject: string;
  /** True when the screen already has content to show; suppresses the sheet. */
  hasContent?: boolean;
  /** Re-runs the failed load. */
  onRetry: () => Promise<unknown> | unknown;
  /** Distinguishes two sheets on one screen. Defaults to `subject`. */
  sheetKey?: string;
}): void {
  const { error, subject, hasContent = false, onRetry, sheetKey } = options;

  // Read during render so the retry handler always sees the screen's latest
  // outcome rather than the error it was created with.
  const errorRef = useRef(error);
  errorRef.current = error;
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (!error || hasContent) return;
    showErrorSheet({
      key: sheetKey ?? subject,
      error,
      subject,
      onRetry: async () => {
        await retryRef.current();
        // Loaders report failure by setting state, not by throwing, so let the
        // re-render land and read the result. Rethrowing keeps the sheet open
        // with an updated message instead of closing on a retry that failed.
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (errorRef.current) throw errorRef.current;
      },
    });
  }, [error, hasContent, subject, sheetKey]);
}
