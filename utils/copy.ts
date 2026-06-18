/** Placeholder when a value is missing. Avoid em dashes in UI copy. */
export const NOT_SET_LABEL = 'Not set';

/** Short empty state for numeric / distance fields. */
export const EMPTY_LABEL = 'N/A';

/** Join subtitle fragments with a comma (reads naturally on small screens). */
export function joinSubtitleParts(parts: string[]): string {
  return parts.filter(Boolean).join(', ');
}
