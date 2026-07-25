import { Text, TextInput } from 'react-native';

/** Caps iOS/Android accessibility text scale so layouts stay balanced (still allows modest scaling). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.25;

let installed = false;

/**
 * Call once at app startup (root layout). Prevents system "Large Text" from blowing up every screen.
 */
export function installTypographyDefaults(maxMultiplier: number = MAX_FONT_SIZE_MULTIPLIER): void {
  if (installed) return;
  installed = true;

  const textDefaults = Text.defaultProps ?? {};
  Text.defaultProps = {
    ...textDefaults,
    allowFontScaling: true,
    maxFontSizeMultiplier: maxMultiplier,
  };

  const inputDefaults = TextInput.defaultProps ?? {};
  TextInput.defaultProps = {
    ...inputDefaults,
    allowFontScaling: true,
    maxFontSizeMultiplier: maxMultiplier,
  };
}
