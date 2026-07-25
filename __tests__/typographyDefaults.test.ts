import { installTypographyDefaults, MAX_FONT_SIZE_MULTIPLIER } from '@/lib/typographyDefaults';
import { Text, TextInput } from 'react-native';

describe('typographyDefaults', () => {
  beforeEach(() => {
    Text.defaultProps = {};
    TextInput.defaultProps = {};
  });

  it('sets maxFontSizeMultiplier on Text and TextInput', () => {
    installTypographyDefaults(1.25);
    expect(Text.defaultProps?.maxFontSizeMultiplier).toBe(1.25);
    expect(TextInput.defaultProps?.maxFontSizeMultiplier).toBe(1.25);
  });

  it('exports a sensible default cap', () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeGreaterThan(1);
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeLessThanOrEqual(1.35);
  });
});
