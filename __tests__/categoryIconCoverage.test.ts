import { getCategoryGlyphName, resolveCategoryImageSource } from '@/utils/categoryIcons';

/**
 * Every trade should look like something.
 *
 * Twenty-four categories have painted artwork bundled with the app. The server
 * can add a category any day without waiting for a release, and until now
 * anything it added showed as two letters in a box - which on a row of
 * illustrated trades reads as the broken one, not as art nobody has drawn yet.
 *
 * These are the names most likely to arrive: the trades the backend already
 * treats as urgent-eligible, and the services a Nigerian home-services
 * marketplace sells. Each has to resolve to a picture, painted or drawn.
 *
 * When artwork is added for one of these, this test keeps passing - it asks
 * only that the name resolves to something, not to which of the two.
 */
const looksLikeSomething = (name: string): boolean =>
  resolveCategoryImageSource(name) != null || getCategoryGlyphName(name) != null;

describe('category icon coverage', () => {
  /** Named on the server exactly like this - see the urgent-eligible list. */
  const urgentEligible = [
    'plumbing',
    'electrical',
    'roofing',
    'generatorRepair',
    'waterProofing',
    'glassWork',
  ];

  it.each(urgentEligible)('draws %s', (name) => {
    expect(looksLikeSomething(name)).toBe(true);
  });

  const commonTrades = [
    'Air Conditioning',
    'AC Repair',
    'Inverter Installation',
    'Welding',
    'Aluminium Works',
    'Mechanic',
    'Landscaping',
    'Gardening',
    'Tailoring',
    'Laundry',
    'Dry Cleaning',
    'Catering',
    'Home Tutoring',
    'Photography',
    'Hairdressing',
    'Makeup Artist',
    'Moving Services',
    'Locksmith',
    'DSTV Installation',
    'Satellite Installation',
    'Internet Installation',
    'Washing Machine Repair',
    'POP Ceiling',
    'Screeding',
    'Fumigation',
    'Interior Design',
    'Furniture Assembly',
    'Wallpaper Installation',
    'Building Construction',
    'Bathroom Fitting',
  ];

  it.each(commonTrades)('draws %s', (name) => {
    expect(looksLikeSomething(name)).toBe(true);
  });

  /**
   * The check that keeps the one above honest. If everything matched, the
   * keyword list would be catching by accident rather than by meaning - a rule
   * like "a" would pass every case here and be worthless.
   */
  it('still shows initials for a name that means nothing', () => {
    expect(looksLikeSomething('Zzyzx')).toBe(false);
    expect(looksLikeSomething('Qwerty Ltd')).toBe(false);
  });

  /** Painted artwork must keep winning; the glyph is a fallback, not a rival. */
  it('prefers the painted artwork where there is some', () => {
    expect(resolveCategoryImageSource('plumbing')).not.toBeNull();
    expect(resolveCategoryImageSource('cleaning')).not.toBeNull();
    expect(resolveCategoryImageSource('roofing')).not.toBeNull();
  });

  it('draws the right thing, not just any thing', () => {
    expect(getCategoryGlyphName('generatorRepair')).toMatch(/Battery/i);
    expect(getCategoryGlyphName('waterProofing')).toMatch(/Droplet/i);
    expect(getCategoryGlyphName('Tailoring')).toMatch(/Shirt/i);
    expect(getCategoryGlyphName('Air Conditioning')).toMatch(/Snowflake/i);
  });
});
