import { formatChatDateSeparator } from '@/utils/chatFormatting';

export type ChatMessageLike = {
  id: string;
  timestamp: string;
  sender: 'user' | 'provider';
  isFromCurrentUser?: boolean;
};

export type ChatListItem =
  | { kind: 'date'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: ChatMessageLike;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

function isSameGroup(a: ChatMessageLike, b: ChatMessageLike): boolean {
  return a.isFromCurrentUser === b.isFromCurrentUser && a.sender === b.sender;
}

export function buildChatListItems<T extends ChatMessageLike>(messages: T[]): Array<
  | { kind: 'date'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: T;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    }
> {
  const items: ChatListItem[] = [];
  let lastDateLabel: string | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dateLabel = formatChatDateSeparator(msg.timestamp);
    if (dateLabel && dateLabel !== lastDateLabel) {
      items.push({ kind: 'date', id: `date-${dateLabel}-${i}`, label: dateLabel });
      lastDateLabel = dateLabel;
    }

    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;

    items.push({
      kind: 'message',
      id: msg.id,
      message: msg,
      isFirstInGroup: !prev || !isSameGroup(prev, msg),
      isLastInGroup: !next || !isSameGroup(msg, next),
    });
  }

  return items as ReturnType<typeof buildChatListItems<T>>;
}
