import { useState } from 'react';

/**
 * Typing indicator for service-request chat.
 * Returns false until backend typing events are wired (WebSocket or poll field).
 */
export function useChatTypingIndicator(_requestId: number | null): {
  isPeerTyping: boolean;
  setPeerTyping: (typing: boolean) => void;
} {
  const [isPeerTyping, setPeerTyping] = useState(false);
  return { isPeerTyping, setPeerTyping };
}
