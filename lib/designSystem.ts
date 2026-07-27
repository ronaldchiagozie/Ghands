import { DESIGN_TOKENS } from './assets';

/**
 * Comprehensive Design System
 * Use these constants throughout the app for consistency
 */

export { SURFACE_STYLES } from './surfaceStyles';

export const Colors = DESIGN_TOKENS.colors;

/** Minimum tappable area per Apple HIG / Material (44×44pt). */
export const MIN_TOUCH_TARGET = 44;

/** Max system font scale for Text / TextInput (see lib/typographyDefaults.ts). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.25;

/** Expands a smaller visual control to meet MIN_TOUCH_TARGET without changing layout. */
export const TOUCH_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/**
 * GHands ships light mode only — sage-on-warm-light is the brand contract.
 * Dark tokens are not defined; `userInterfaceStyle` is locked to light in app.config.js.
 */
export const APP_COLOR_SCHEME = 'light' as const;

/** Tablet “phone lane” constants and hooks (single import surface with theme). */
export {
  TABLET_MIN_SHORT_EDGE,
  PHONE_LANE_OUTER_TOP,
  TAB_SCROLL_TOP,
  CLIENT_TAB_BAR_BASE_HEIGHT,
  useIsTablet,
  useIsCompactPhone,
  useNarrowOverlayMaxWidth,
  useTabScrollContentPaddingTop,
  useBottomTabBarHeight,
  useTabScreenScrollBottomPadding,
  useTabScreenBottomSpacerHeight,
  useSageHeroPanelMetrics,
  CLIENT_HOME_SCROLL_GUTTER,
  PROVIDER_TAB_GUTTER,
} from './tabletLayout';
export { useKeyboardAvoidingOffset, useScrollViewKeyboardAssist } from './keyboardLayout';
export const Spacing = DESIGN_TOKENS.spacing;
export const BorderRadius = DESIGN_TOKENS.borderRadius;

/**
 * Standardized spacing scale
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/**
 * Standardized screen padding
 */
export const SCREEN_PADDING = {
  horizontal: 20,
  vertical: 24,
  top: 24,
  bottom: 24,
} as const;

/**
 * Standardized button heights
 */
export const BUTTON_HEIGHTS = {
  small: 40,
  medium: 48,
  large: 56,
} as const;

/**
 * Standardized input heights
 */
export const INPUT_HEIGHTS = {
  small: 44,
  medium: 52,
  large: 60,
} as const;

/**
 * RefreshControl styling (tintColor for iOS, colors for Android)
 */
export const REFRESH_CONTROL = {
  tintColor: Colors.accent,
  colors: [Colors.accent] as const,
} as const;

export { getButtonVariantStyles, type ButtonVariant } from '@/lib/buttonTheme';

/**
 * Legacy scale — kept at zero; use SURFACE_STYLES for UI depth.
 */
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

/**
 * Standardized opacity values
 */
export const OPACITY = {
  disabled: 0.5,
  pressed: 0.8,
  overlay: 0.5,
  subtle: 0.1,
} as const;

/**
 * Standardized border widths
 */
export const BORDER_WIDTH = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 3,
} as const;

/**
 * Standardized icon sizes
 */
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Standardized animation durations
 */
export const ANIMATION_DURATION = {
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

export { useReducedMotion } from '../hooks/useReducedMotion';
export { JOB_STATUS_BADGE } from './statusBadges';
export type { JobStatusBadgeKey } from './statusBadges';
export {
  MOTION_EASING,
  motionDuration,
  runParallel,
  runSpring,
  runTiming,
  setAnimatedValue,
} from './motion';

/**
 * Helper function to get consistent spacing
 */
export function getSpacing(multiplier: number = 1): number {
  return SPACING.md * multiplier;
}

/**
 * Helper function to get screen padding
 */
export function getScreenPadding(side: 'horizontal' | 'vertical' | 'top' | 'bottom' = 'horizontal'): number {
  return SCREEN_PADDING[side];
}
