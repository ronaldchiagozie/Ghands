import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Treat as tablet when the shorter window edge reaches this (iPad / large Android tablet). */
export const TABLET_MIN_SHORT_EDGE = 600;

/** Max width of the centered “phone lane” on tablets (pt). Wider = more horizontal space for content. */
export const PHONE_LANE_MAX_WIDTH = 520;

export const PHONE_LANE_MIN_HEIGHT = 600;
/** Upper cap (pt) for the framed app height on tablets (large iPads can approach this) */
export const PHONE_LANE_MAX_HEIGHT = 960;
/** Share of available height (between safe insets) used for the phone lane — keep below 1 so UI doesn’t feel oversized on iPad */
export const PHONE_LANE_HEIGHT_FRACTION = 0.94;

/** Space from top of lane to content after skipping device top safe inset (tab shell). */
export const PHONE_LANE_OUTER_TOP = 14;

/** Horizontal padding for client home scroll sections. */
export const CLIENT_HOME_SCROLL_GUTTER = 16;

/** Provider tab screens — same gutter as client home for aligned content width. */
export const PROVIDER_TAB_GUTTER = CLIENT_HOME_SCROLL_GUTTER;

/** Shared top padding for main vertical scroll content on tab screens (tablet). */
export const TAB_SCROLL_TOP = 32;

export function isTabletSize(width: number, height: number): boolean {
  return Math.min(width, height) >= TABLET_MIN_SHORT_EDGE;
}

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return useMemo(() => isTabletSize(width, height), [width, height]);
}

/**
 * Use on primary tab screens: on tablet returns {@link TAB_SCROLL_TOP}; on phone returns `phoneValue`.
 */
export function useTabScrollContentPaddingTop(phoneValue: number): number {
  const isTablet = useIsTablet();
  return isTablet ? TAB_SCROLL_TOP : phoneValue;
}

export function computePhoneLaneHeight(windowHeight: number, topInset: number, bottomInset: number): number {
  const availableH = windowHeight - topInset - bottomInset;
  return Math.min(
    PHONE_LANE_MAX_HEIGHT,
    Math.max(PHONE_LANE_MIN_HEIGHT, Math.floor(availableH * PHONE_LANE_HEIGHT_FRACTION))
  );
}

/**
 * Max width for toasts, banners, and centered overlays so they don’t stretch edge-to-edge on
 * tablets or in landscape. Updates on rotation via {@link useWindowDimensions}.
 */
export function useNarrowOverlayMaxWidth(horizontalGutter: number = 32): number {
  const { width } = useWindowDimensions();
  return useMemo(
    () => Math.min(PHONE_LANE_MAX_WIDTH, Math.max(0, width - horizontalGutter)),
    [width, horizontalGutter]
  );
}

/**
 * Whether the shortest side is phone-sized (narrow) — useful for tightening padding on small Android phones.
 */
export function useIsCompactPhone(): boolean {
  const { width, height } = useWindowDimensions();
  return useMemo(() => Math.min(width, height) < 360, [width, height]);
}

/**
 * Bottom tab bar content row height (icons + labels), before the home-indicator inset.
 * `paddingBottom` on the tab bar should be only `insets.bottom` — no extra band below labels.
 */
export const CLIENT_TAB_BAR_BASE_HEIGHT = Platform.OS === 'ios' ? 50 : 46;
/** @deprecated Use safe-area inset only for tab bar paddingBottom in layouts */
export const CLIENT_TAB_BAR_PADDING_BOTTOM = 0;

/** Provider tabs use the same measurements for consistency. */
export const PROVIDER_TAB_BAR_BASE_HEIGHT = CLIENT_TAB_BAR_BASE_HEIGHT;
export const PROVIDER_TAB_BAR_PADDING_BOTTOM = CLIENT_TAB_BAR_PADDING_BOTTOM;

/**
 * Total height of the floating tab bar including bottom safe area (gesture bar / home indicator).
 */
export function useBottomTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => CLIENT_TAB_BAR_BASE_HEIGHT + insets.bottom,
    [insets.bottom]
  );
}

/**
 * ScrollView / FlatList `contentContainerStyle.paddingBottom` on tab screens (tab bar + gap).
 */
export function useTabScreenScrollBottomPadding(extraGap: number = 12): number {
  const barH = useBottomTabBarHeight();
  return useMemo(() => barH + extraGap, [barH, extraGap]);
}

/**
 * Fixed spacer `View` height at end of scroll (same idea as padding).
 */
export function useTabScreenBottomSpacerHeight(extraGap: number = 12): number {
  return useTabScreenScrollBottomPadding(extraGap);
}

/** Shared padding + headline size for sage hero panels (home earnings, wallet balance, etc.). */
export function useSageHeroPanelMetrics() {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isTablet = useIsTablet();
  return useMemo(
    () => ({
      paddingV: isTablet ? Math.max(18, Math.round(windowHeight * 0.022)) : 17,
      paddingH: isTablet ? Math.max(16, Math.round(windowWidth * 0.036)) : 15,
      amountFontSize: isTablet
        ? Math.min(30, Math.max(26, Math.round(windowHeight * 0.028)))
        : 27,
    }),
    [isTablet, windowHeight, windowWidth]
  );
}
