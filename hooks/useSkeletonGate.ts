import { useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 220;
const DEFAULT_MIN_VISIBLE_MS = 380;

type SkeletonGateOptions = {
  /** Wait before showing skeleton - skips flash on fast loads */
  delayMs?: number;
  /** Minimum time skeleton stays visible once shown */
  minVisibleMs?: number;
};

export type SkeletonGateState = {
  /** Gated shimmer placeholders (delayed to avoid flash on very fast loads) */
  showSkeleton: boolean;
  /** Loading with no data yet - use to hide empty states and reserve the section */
  isLoadingEmpty: boolean;
};

/**
 * Professional skeleton gate: suppresses empty states while loading, shows shimmer
 * only when loading is slow enough. Avoids flicker on refresh when data exists.
 */
export function useSkeletonGate(
  isLoading: boolean,
  isEmpty: boolean,
  options: SkeletonGateOptions = {}
): SkeletonGateState {
  const { delayMs = DEFAULT_DELAY_MS, minVisibleMs = DEFAULT_MIN_VISIBLE_MS } = options;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoadingEmpty = isLoading && isEmpty;

  useEffect(() => {
    const clearTimers = () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    if (isLoadingEmpty) {
      if (!visible && !delayTimerRef.current) {
        delayTimerRef.current = setTimeout(() => {
          delayTimerRef.current = null;
          shownAtRef.current = Date.now();
          setVisible(true);
        }, delayMs);
      }
    } else {
      clearTimers();
      if (visible) {
        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, minVisibleMs - elapsed);
        hideTimerRef.current = setTimeout(() => {
          hideTimerRef.current = null;
          setVisible(false);
        }, remaining);
      } else {
        setVisible(false);
      }
    }

    return clearTimers;
  }, [isLoadingEmpty, delayMs, minVisibleMs, visible]);

  return {
    showSkeleton: visible && isEmpty,
    isLoadingEmpty,
  };
}
