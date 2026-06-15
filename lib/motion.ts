import { Animated, Easing } from 'react-native';
import { ANIMATION_DURATION } from './designSystem';

/** Product UI easing — ease-out curves, no bounce/elastic. */
export const MOTION_EASING = {
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  outQuint: Easing.bezier(0.22, 1, 0.36, 1),
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
} as const;

export function motionDuration(reducedMotion: boolean, duration: number): number {
  return reducedMotion ? 0 : duration;
}

export function setAnimatedValue(value: Animated.Value, toValue: number): void {
  value.setValue(toValue);
}

export function runTiming(
  reducedMotion: boolean,
  value: Animated.Value,
  config: Animated.TimingAnimationConfig,
  onComplete?: Animated.EndCallback
): void {
  const duration = motionDuration(reducedMotion, config.duration ?? ANIMATION_DURATION.normal);
  if (duration === 0) {
    setAnimatedValue(value, typeof config.toValue === 'number' ? config.toValue : 1);
    onComplete?.({ finished: true });
    return;
  }
  Animated.timing(value, { ...config, duration }).start(onComplete);
}

export function runSpring(
  reducedMotion: boolean,
  value: Animated.Value,
  config: Animated.SpringAnimationConfig,
  onComplete?: Animated.EndCallback
): void {
  if (reducedMotion) {
    setAnimatedValue(value, typeof config.toValue === 'number' ? config.toValue : 1);
    onComplete?.({ finished: true });
    return;
  }
  Animated.spring(value, config).start(onComplete);
}

export function runParallel(
  reducedMotion: boolean,
  animations: Animated.CompositeAnimation[],
  onComplete?: Animated.EndCallback
): void {
  if (reducedMotion || animations.length === 0) {
    onComplete?.({ finished: true });
    return;
  }
  Animated.parallel(animations).start(onComplete);
}
