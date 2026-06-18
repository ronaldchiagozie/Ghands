const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/** Peer is "Active now" when their last message was within this window. */
export const CHAT_ACTIVE_NOW_MS = 2 * MS_MINUTE;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Date pill label: Today, Yesterday, Jun 12, etc. */
export function formatChatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameCalendarDay(date, now)) return 'Today';
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Header subtitle from peer's last message timestamp. */
export function formatLastActiveLabel(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) return 'No messages yet';

  const then = new Date(lastActiveAt).getTime();
  if (Number.isNaN(then)) return 'No messages yet';

  const diff = Date.now() - then;
  if (diff < CHAT_ACTIVE_NOW_MS) return 'Active now';

  if (diff < MS_HOUR) {
    const mins = Math.max(1, Math.floor(diff / MS_MINUTE));
    return `Active ${mins}m ago`;
  }

  if (diff < MS_DAY) {
    const hours = Math.max(1, Math.floor(diff / MS_HOUR));
    return `Active ${hours}h ago`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(new Date(then), yesterday)) return 'Active yesterday';

  const days = Math.floor(diff / MS_DAY);
  if (days < 7) return `Active ${days}d ago`;

  return `Active ${formatChatDateSeparator(lastActiveAt)}`;
}

export function isPeerRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const then = new Date(lastActiveAt).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < CHAT_ACTIVE_NOW_MS;
}
