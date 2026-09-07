/**
 * Which providers the map is willing to draw.
 *
 * The backend gates /nearby itself now, so `verified` comes back true for
 * everyone and the backend has said the field is redundant in that response.
 * That makes it a strong candidate for removal in a future tidy-up, and a
 * truthiness test would then hide every provider on the map and report "none
 * found nearby" while the server was behaving perfectly.
 */
const isEligible = (provider: { verified?: boolean } | null | undefined) =>
  provider?.verified !== false;

describe('provider visibility on the map', () => {
  it('draws a verified provider', () => {
    expect(isEligible({ verified: true })).toBe(true);
  });

  it('refuses one the server explicitly marks unverified', () => {
    expect(isEligible({ verified: false })).toBe(false);
  });

  /** The case that matters: a field the backend has called redundant. */
  it('still draws providers when the field is gone entirely', () => {
    expect(isEligible({})).toBe(true);
    expect(isEligible({ verified: undefined })).toBe(true);
  });
});
