/** Placeholder when a value is missing. Avoid em dashes in UI copy. */
export const NOT_SET_LABEL = 'Not set';

/** Short empty state for numeric / distance fields. */
export const EMPTY_LABEL = 'N/A';

/** Join subtitle fragments with a comma (reads naturally on small screens). */
export function joinSubtitleParts(parts: string[]): string {
  return parts.filter(Boolean).join(', ');
}

/**
 * Normalize em/en dashes in user-facing copy to commas or periods.
 * Use when rendering API or legacy strings that may contain — or –.
 */
export function normalizeUiPunctuation(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/,\s+([A-Z])/g, '. $1')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .trim();
}
