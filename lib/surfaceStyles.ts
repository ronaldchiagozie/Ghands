import { Platform, type ViewStyle } from 'react-native';

/**
 * Android: `elevation` adds a strong material shadow - keep it at a single low step.
 * iOS: use the numeric value as-is with `shadow*` from the same style object.
 */
export function surfaceElevation(value: number): number {
  if (value <= 0) return 0;
  // Android: skip material elevation - shadows read heavy; use borders / hairlines instead.
  if (Platform.OS === 'android') return 0;
  return Math.round(value);
}

/**
 * Minimal Android Material elevation (0-1). Use with iosOnlyShadow() for iOS depth.
 */
export function androidElevation(level: 0 | 1 = 1): number {
  return Platform.OS === 'android' ? level : 0;
}

/** Apply shadow* only on iOS - Android uses elevation via androidElevation(). */
export function iosOnlyShadow(style: ViewStyle): ViewStyle {
  return Platform.OS === 'ios' ? style : {};
}

/**
 * Card / field elevation tokens - standalone module (no designSystem imports)
 * so map and tab screens never hit a partial-loaded barrel.
 */
export const SURFACE_STYLES: {
  homeTile: ViewStyle;
  homeCard: ViewStyle;
  floatingSheet: ViewStyle;
  searchField: ViewStyle;
  chipOutline: ViewStyle;
} = {
  homeTile: {
    borderWidth: 0,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: surfaceElevation(2),
  },
  /**
   * The home surface: a hairline edge and nothing else.
   *
   * These cards sit flat on the page rather than above it. A shadow says a
   * surface is lifted and separate, which is worth spending on something that
   * floats over other content - a sheet, a menu, a dialog. A column of cards
   * that make up the page itself is not floating over anything, and giving
   * every one of them a lift only makes the page feel heavy.
   */
  homeCard: {
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.12)',
  },
  /**
   * For surfaces that genuinely do float: the provider sheet over the map.
   * This is what homeCard used to be, kept where the lift is doing its job.
   */
  floatingSheet: {
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.12)',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: surfaceElevation(2),
  },
  searchField: {
    borderWidth: 0,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: surfaceElevation(2),
  },
  chipOutline: {
    borderWidth: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.04)',
  },
};
