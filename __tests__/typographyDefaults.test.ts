import {
  installTypographyDefaults,
  MAX_FONT_SIZE_MULTIPLIER,
  resetTypographyDefaultsForTest,
  textHost,
  textInputHost,
} from '@/lib/typographyDefaults';

describe('typographyDefaults', () => {
  beforeEach(() => {
    resetTypographyDefaultsForTest();
  });

  it('sets maxFontSizeMultiplier on Text and TextInput', () => {
    installTypographyDefaults(1.25);
    expect(textHost.defaultProps?.maxFontSizeMultiplier).toBe(1.25);
    expect(textInputHost.defaultProps?.maxFontSizeMultiplier).toBe(1.25);
  });

  it('keeps font scaling enabled so the cap does not disable accessibility', () => {
    installTypographyDefaults(1.25);
    expect(textHost.defaultProps?.allowFontScaling).toBe(true);
    expect(textInputHost.defaultProps?.allowFontScaling).toBe(true);
  });

  it('only installs once', () => {
    installTypographyDefaults(1.25);
    installTypographyDefaults(2);
    expect(textHost.defaultProps?.maxFontSizeMultiplier).toBe(1.25);
  });

  it('exports a sensible default cap', () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeGreaterThan(1);
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeLessThanOrEqual(1.35);
  });
});
