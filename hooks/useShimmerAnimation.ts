import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
/** Long diagonal travel — highlight sweeps top-left → bottom-right */
const SHIMMER_TRAVEL_X = SCREEN_W * 1.65;
const SHIMMER_TRAVEL_Y = SCREEN_H * 0.22;
const SHIMMER_STOP_GRACE_MS = 800;
const SHIMMER_ROTATE = '-24deg';

let sharedProgress: Animated.Value | null = null;
let sharedLoop: Animated.CompositeAnimation | null = null;
let subscriberCount = 0;
let stopGraceTimer: ReturnType<typeof setTimeout> | null = null;

function ensureShimmerLoop(): Animated.Value {
  if (stopGraceTimer) {
    clearTimeout(stopGraceTimer);
    stopGraceTimer = null;
  }

  if (!sharedProgress) {
    sharedProgress = new Animated.Value(0);
    sharedLoop = Animated.loop(
      Animated.timing(sharedProgress, {
        toValue: 1,
        duration: 2100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    sharedLoop.start();
  }
  return sharedProgress;
}

function scheduleShimmerStop() {
  if (stopGraceTimer) clearTimeout(stopGraceTimer);
  stopGraceTimer = setTimeout(() => {
    stopGraceTimer = null;
    if (subscriberCount <= 0 && sharedLoop) {
      sharedLoop.stop();
      sharedLoop = null;
      sharedProgress = null;
      subscriberCount = 0;
    }
  }, SHIMMER_STOP_GRACE_MS);
}

/** One shared shimmer wave — all skeleton blocks stay in sync. */
export function useShimmerAnimation() {
  const reducedMotion = useReducedMotion();
  const progressRef = useRef<Animated.Value | null>(null);
  const staticProgress = useRef(new Animated.Value(0.5)).current;
  const shimmerEnabled = !reducedMotion;

  if (shimmerEnabled && !progressRef.current) {
    progressRef.current = ensureShimmerLoop();
  }

  useEffect(() => {
    if (!shimmerEnabled) return;

    subscriberCount += 1;
    ensureShimmerLoop();

    return () => {
      subscriberCount -= 1;
      if (subscriberCount <= 0) {
        scheduleShimmerStop();
      }
    };
  }, [shimmerEnabled]);

  const progress = shimmerEnabled ? progressRef.current! : staticProgress;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_TRAVEL_X, SHIMMER_TRAVEL_X],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_TRAVEL_Y, SHIMMER_TRAVEL_Y],
  });

  return {
    translateX,
    translateY,
    shimmerWidth: SHIMMER_TRAVEL_X * 0.32,
    shimmerRotate: SHIMMER_ROTATE,
    shimmerEnabled,
  };
}

/** Mature neutral shimmer — warm gray base, restrained highlight. */
export const SHIMMER_PALETTE = {
  default: {
    base: '#D8DEE3',
    highlight: 'rgba(255, 255, 255, 0.36)',
    edge: 'rgba(255, 255, 255, 0.12)',
  },
  sage: {
    base: 'rgba(255, 255, 255, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.26)',
    edge: 'rgba(255, 255, 255, 0.08)',
  },
} as const;
