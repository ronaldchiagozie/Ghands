jest.mock('@/services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  extractResponseData: jest.requireActual('@/services/api/client').extractResponseData,
}));

import { apiClient } from '@/services/api/client';
import { discoverService } from '@/services/api/discover';

const get = apiClient.get as jest.Mock;

/**
 * Discover ran on two hardcoded arrays and a map with an empty provider list.
 * These are the guards on the data that replaced them - and most of them are
 * about the one thing this tab must never do, which is claim to know what is
 * popular near somebody when it does not.
 */
describe('discoverService.getPopular', () => {
  beforeEach(() => get.mockReset());

  const ok = (data: unknown) => get.mockResolvedValue({ success: true, data });

  it('reads a local answer as local', async () => {
    ok({
      scope: 'area',
      scopeLabel: 'Lekki',
      windowDays: 30,
      items: [
        { categoryName: 'plumbing', displayName: 'Plumbing', bookings: 148, providersAvailable: 23, medianPrice: 18000 },
      ],
    });

    const result = await discoverService.getPopular(6.4, 3.4);

    expect(result?.scope).toBe('area');
    expect(result?.scopeLabel).toBe('Lekki');
    expect(result?.items[0]).toEqual({
      categoryName: 'plumbing',
      displayName: 'Plumbing',
      bookings: 148,
      providersAvailable: 23,
      medianPrice: 18000,
    });
  });

  /**
   * The one that matters most. If a scope arrives that this app does not
   * understand, guessing "area" would print "Popular near you" over numbers
   * from the whole country. Guessing the widest is wrong in the harmless
   * direction: it undersells a real local answer instead of inventing one.
   */
  it('treats an unrecognised scope as the widest, never as local', async () => {
    ok({ scope: 'region', scopeLabel: 'Somewhere', items: [] });
    await expect(discoverService.getPopular(6.4, 3.4)).resolves.toMatchObject({ scope: 'national' });

    ok({ scopeLabel: 'Somewhere', items: [] });
    await expect(discoverService.getPopular(6.4, 3.4)).resolves.toMatchObject({ scope: 'national' });
  });

  /** A missing price is a missing price. Zero would read as free. */
  it('keeps an absent median price absent', async () => {
    ok({
      scope: 'city',
      scopeLabel: 'Lagos',
      items: [{ categoryName: 'cleaning', displayName: 'Cleaning', bookings: 9, providersAvailable: 2, medianPrice: null }],
    });

    const result = await discoverService.getPopular(6.4, 3.4);
    expect(result?.items[0].medianPrice).toBeNull();
  });

  it('drops an entry with no category, since nothing can be booked from it', async () => {
    ok({
      scope: 'area',
      scopeLabel: 'Yaba',
      items: [
        { categoryName: '  ', displayName: 'Mystery', bookings: 50 },
        { categoryName: 'painting', displayName: 'Painting', bookings: 40 },
      ],
    });

    const result = await discoverService.getPopular(6.4, 3.4);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].categoryName).toBe('painting');
  });

  /**
   * Null and empty are different answers: "there is nothing popular here" is
   * worth saying, "we could not ask" is not the same sentence.
   */
  it('returns null when the call fails, not an empty list', async () => {
    get.mockRejectedValue(new Error('offline'));
    await expect(discoverService.getPopular(6.4, 3.4)).resolves.toBeNull();
  });

  it('returns an empty list when the server genuinely has nothing', async () => {
    ok({ scope: 'national', scopeLabel: 'Nigeria', items: [] });
    const result = await discoverService.getPopular(6.4, 3.4);
    expect(result).not.toBeNull();
    expect(result?.items).toEqual([]);
  });

  it('falls back to the thirty day window when the server omits it', async () => {
    ok({ scope: 'area', scopeLabel: 'Ikeja', items: [] });
    await expect(discoverService.getPopular(6.4, 3.4)).resolves.toMatchObject({ windowDays: 30 });
  });
});

describe('discoverService.getTips', () => {
  beforeEach(() => get.mockReset());

  it('keeps the link, which is the whole point of a tip', async () => {
    get.mockResolvedValue({
      success: true,
      data: [{ id: 3, title: 'Find your stop valve', body: 'Before you need it.', url: 'https://ghand.com.ng/servicetips/stop-valve' }],
    });

    const [tip] = await discoverService.getTips();
    expect(tip.url).toBe('https://ghand.com.ng/servicetips/stop-valve');
  });

  it('drops a tip with no title rather than rendering a blank row', async () => {
    get.mockResolvedValue({ success: true, data: [{ id: 1, title: '   ' }, { id: 2, title: 'Real' }] });

    const tips = await discoverService.getTips();
    expect(tips.map((tip) => tip.title)).toEqual(['Real']);
  });

  it('says nothing rather than throwing when the call fails', async () => {
    get.mockRejectedValue(new Error('offline'));
    await expect(discoverService.getTips()).resolves.toEqual([]);
  });
});
