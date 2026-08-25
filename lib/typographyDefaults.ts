import { Text, TextInput, type TextProps, type TextInputProps } from 'react-native';

/** Caps iOS/Android accessibility text scale so layouts stay balanced (still allows modest scaling). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.25;

/**
 * React Native still honours `defaultProps` on its host components at runtime,
 * but the typings stopped exposing it. The behaviour is deliberate — only the
 * type is missing — so the cast lives here once instead of being scattered as
 * `as any` at each use.
 */
type HostWithDefaults<P> = { defaultProps?: Partial<P> };

export const textHost = Text as unknown as HostWithDefaults<TextProps>;
export const textInputHost = TextInput as unknown as HostWithDefaults<TextInputProps>;

let installed = false;

/**
 * Call once at app startup (root layout). Prevents system "Large Text" from blowing up every screen.
 */
export function installTypographyDefaults(maxMultiplier: number = MAX_FONT_SIZE_MULTIPLIER): void {
  if (installed) return;
  installed = true;

  textHost.defaultProps = {
    ...(textHost.defaultProps ?? {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: maxMultiplier,
  };

  textInputHost.defaultProps = {
    ...(textInputHost.defaultProps ?? {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: maxMultiplier,
  };
}

/** Test seam: lets suites reset the host defaults between cases. */
export function resetTypographyDefaultsForTest(): void {
  installed = false;
  textHost.defaultProps = {};
  textInputHost.defaultProps = {};
}
