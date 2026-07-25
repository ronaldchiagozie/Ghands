import { resolveProviderDisplayName } from '@/utils/providerDisplayName';

describe('resolveProviderDisplayName', () => {
  it('uses name from API', () => {
    expect(resolveProviderDisplayName({ name: 'Ace Plumbing Ltd' }, { id: 3 })).toBe(
      'Ace Plumbing Ltd',
    );
  });

  it('falls back to companyName when name is empty', () => {
    expect(
      resolveProviderDisplayName({ name: '', companyName: 'Bright Sparks NG' }, { id: 7 }),
    ).toBe('Bright Sparks NG');
  });

  it('uses id label when name equals category slug', () => {
    expect(
      resolveProviderDisplayName({ name: 'plumbing' }, { id: 12, categoryLabel: 'Plumbing' }),
    ).toBe('Service provider #12');
  });
});
