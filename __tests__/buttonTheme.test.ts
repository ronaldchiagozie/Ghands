import { getButtonVariantStyles } from '@/lib/buttonTheme';

describe('buttonTheme', () => {
  it('uses white label on primary and secondary', () => {
    expect(getButtonVariantStyles('primary', false).label).toBe('#FFFFFF');
    expect(getButtonVariantStyles('secondary', false).label).toBe('#FFFFFF');
  });

  it('uses sage background for primary', () => {
    expect(getButtonVariantStyles('primary', false).container.backgroundColor).toBe('#4F6739');
  });

  it('uses muted surface when disabled', () => {
    const disabled = getButtonVariantStyles('primary', true);
    expect(disabled.label).not.toBe('#D7FF6B');
    expect(disabled.container.backgroundColor).toBe('#F3F4F6');
  });
});
