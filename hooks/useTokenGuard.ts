/**
 * @deprecated Session enforcement is handled globally by useSessionTimeout in app/_layout.tsx.
 * Kept as a no-op so existing imports do not duplicate redirects.
 */
export function useTokenGuard(): void {
  /* intentionally empty — see useSessionTimeout */
}
