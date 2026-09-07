import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * How a message arrives.
 *
 * Bubbles used to appear fully formed between one frame and the next, which
 * reads as a list refreshing rather than somebody answering. They rise a
 * short way and settle now, on a spring, so a reply lands instead of
 * materialising.
 *
 * Once each, and only once. A chat is a scrolling list that recycles its rows,
 * so animating on mount would replay the whole conversation every time
 * somebody scrolled up through it - which would be worse than no animation at
 * all. Ids that have already played are remembered here and render at rest.
 */

const played = new Set<string>();

/** Called when a chat is cleared, so the next conversation animates in fresh. */
export function resetChatEntrances(): void {
  played.clear();
}

/**
 * Marks messages as already seen without animating them.
 *
 * Reopening a conversation restores messages that were read hours ago, and
 * flying twenty of them in at once would be a performance rather than a
 * return. History is already there when the screen appears; only what arrives
 * next moves.
 *
 * Must run before the messages are handed to the list, which is why the caller
 * does it in the same tick as the state update.
 */
export function markChatEntrancesSeen(ids: readonly string[]): void {
  ids.forEach((id) => played.add(id));
}

type AiChatEnterProps = {
  /** Stable per message. Two rows may share one message, so callers add a suffix. */
  entranceKey: string;
  /** Their own messages come from the right, Handy's from the left. */
  from?: 'left' | 'right';
  children: React.ReactNode;
};

export default function AiChatEnter({ entranceKey, from = 'left', children }: AiChatEnterProps) {
  const reducedMotion = useReducedMotion();
  /**
   * Decided once, at first render. Reading the set during render on every pass
   * would flip the answer the moment the effect below records the id.
   */
  const shouldAnimate = useRef(!reducedMotion && !played.has(entranceKey)).current;

  const progress = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  useEffect(() => {
    played.add(entranceKey);
    if (!shouldAnimate) {
      progress.setValue(1);
      return;
    }

    Animated.spring(progress, {
      toValue: 1,
      /** Soft enough to read as settling, quick enough not to hold up a reply. */
      tension: 70,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [entranceKey, progress, shouldAnimate]);

  if (!shouldAnimate) return <>{children}</>;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  /**
   * A little sideways drift from the edge the message belongs to, so the two
   * speakers enter from their own sides rather than both rising off the floor.
   */
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from === 'right' ? 12 : -12, 0],
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}
