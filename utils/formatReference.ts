/** Shorten long refs for UI (full value still used in share/support). */
export function truncateMiddle(value: string, head = 10, tail = 8): string {
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 1) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}
