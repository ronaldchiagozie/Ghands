import { useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * One shared pulse for every skeleton block on screen. Identical in both apps.
 *
 * This used to be a shimmer: each block clipped a rotated gradient about four
 * times its own height, sweeping across three screen widths. A loading screen
 * has dozens of blocks, and redrawing all of them every frame kept the UI
 * thread busy enough that taps landed seconds late - the provider app felt
 * frozen until its skeleton went away. Fading a flat block is about the
 * cheapest animation there is, and it is what most apps settle on.
 */
const PULSE_MS = 850;
const STOP_GRACE_MS = 800;

let sharedValue: Animated.Value | null = null;
let sharedLoop: Animated.CompositeAnimation | null = null;
let subscriberCount = 0;
let stopGraceTimer: ReturnType<typeof setTimeout> | null = null;

function ensurePulse(): Animated.Value {
  if (stopGraceTimer) {
    clearTimeout(stopGraceTimer);
    stopGraceTimer = null;
  }
  if (!sharedValue) {
    sharedValue = new Animated.Value(0);
    sharedLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sharedValue, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sharedValue, {
          toValue: 0,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    sharedLoop.start();
  }
  return sharedValue;
}

/** Stops the loop a moment after the last skeleton goes, so a quick re-mount does not restart it. */
function scheduleStop(): void {
  if (stopGraceTimer) clearTimeout(stopGraceTimer);
  stopGraceTimer = setTimeout(() => {
    stopGraceTimer = null;
    if (subscriberCount <= 0 && sharedLoop) {
      sharedLoop.stop();
      sharedLoop = null;
      sharedValue = null;
      subscriberCount = 0;
    }
  }, STOP_GRACE_MS);
}

/** The opacity a skeleton block should use: pulsing, or steady under Reduce Motion. */
export function useSkeletonPulse(): Animated.AnimatedInterpolation<number> | number {
  const reducedMotion = useReducedMotion();
  const value = reducedMotion ? null : ensurePulse();

  useEffect(() => {
    if (reducedMotion) return;
    subscriberCount += 1;
    ensurePulse();
    return () => {
      subscriberCount -= 1;
      if (subscriberCount <= 0) scheduleStop();
    };
  }, [reducedMotion]);

  if (!value) return 1;
  return value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
}

/** Block colours: a warm grey on white, a light frost on the green hero panels. */
export const SHIMMER_PALETTE = {
  default: { base: '#DEE3E7' },
  sage: { base: 'rgba(255, 255, 255, 0.16)' },
} as const;
