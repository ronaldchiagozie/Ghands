import { apiClient, extractResponseData } from './client';

/**
 * What Discover reads.
 *
 * The tab used to run on two hardcoded arrays and a map with an empty
 * provider list. These are the endpoints that replace them.
 */

/**
 * Which question the server actually answered.
 *
 * The most important field in the response, and the reason this section can
 * exist honestly at all. Ranking near somebody needs bookings near somebody,
 * and most areas do not have enough yet - so the server widens, and says how
 * far it had to go. The app names what it is showing rather than claiming
 * local knowledge it does not have.
 */
export type PopularScope = 'area' | 'city' | 'national';

export type PopularService = {
  /** Matches the categories endpoint exactly, so it can start a booking. */
  categoryName: string;
  displayName: string;
  bookings: number;
  providersAvailable: number;
  /** Null when there are too few accepted quotes to be honest about. */
  medianPrice: number | null;
};

export type PopularServices = {
  scope: PopularScope;
  /** A real place name, screen-ready: "Lekki", "Lagos", "Nigeria". */
  scopeLabel: string;
  windowDays: number;
  items: PopularService[];
};

export type ServiceTip = {
  id: number;
  title: string;
  body: string;
  categoryName?: string | null;
  imageUrl?: string | null;
  /** Where tapping goes. A link out, not an article this app renders. */
  url?: string | null;
};

/**
 * A number, or nothing.
 *
 * The explicit null and empty-string guards are the point. `Number(null)` is
 * 0 and so is `Number('')`, both perfectly finite - so without them a price
 * the server deliberately withheld would arrive as zero and print as free,
 * which is the exact failure medianPrice's nullability exists to prevent.
 */
const asFiniteNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'boolean') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SCOPES: PopularScope[] = ['area', 'city', 'national'];

export const discoverService = {
  /**
   * Categories people around here actually book.
   *
   * Returns null - not an empty result - when the call fails, so the screen
   * can tell "nothing to show" apart from "we could not ask". They deserve
   * different words.
   */
  getPopular: async (
    latitude: number,
    longitude: number,
    radiusKm = 10,
    limit = 6,
  ): Promise<PopularServices | null> => {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        radiusKm: String(radiusKm),
        limit: String(limit),
      });
      const response = await apiClient.get<any>(`/api/discover/popular?${params.toString()}`);
      const data = extractResponseData<any>(response);
      if (!data) return null;

      const items = Array.isArray(data.items) ? data.items : [];

      return {
        /** An unknown scope is treated as the widest, never as local. */
        scope: SCOPES.includes(data.scope) ? data.scope : 'national',
        scopeLabel: typeof data.scopeLabel === 'string' ? data.scopeLabel.trim() : '',
        windowDays: asFiniteNumber(data.windowDays) ?? 30,
        items: items
          .map((item: any): PopularService | null => {
            const categoryName = typeof item?.categoryName === 'string' ? item.categoryName.trim() : '';
            if (!categoryName) return null;
            return {
              categoryName,
              displayName:
                typeof item?.displayName === 'string' && item.displayName.trim()
                  ? item.displayName.trim()
                  : categoryName,
              bookings: asFiniteNumber(item?.bookings) ?? 0,
              providersAvailable: asFiniteNumber(item?.providersAvailable) ?? 0,
              medianPrice: asFiniteNumber(item?.medianPrice),
            };
          })
          .filter((item: PopularService | null): item is PopularService => item != null),
      };
    } catch {
      return null;
    }
  },

  /**
   * Published tips, written by an admin rather than typed into this file.
   *
   * An empty list is a real answer: nothing published yet means the section
   * does not appear, which is better than three sentences that were true of
   * nobody in particular.
   */
  getTips: async (limit = 3): Promise<ServiceTip[]> => {
    try {
      const response = await apiClient.get<any>(`/api/discover/tips?limit=${encodeURIComponent(limit)}`);
      const data = extractResponseData<any>(response);
      if (!Array.isArray(data)) return [];

      return data
        .map((tip: any): ServiceTip | null => {
          const id = asFiniteNumber(tip?.id);
          const title = typeof tip?.title === 'string' ? tip.title.trim() : '';
          if (id == null || !title) return null;
          return {
            id,
            title,
            body: typeof tip?.body === 'string' ? tip.body.trim() : '',
            categoryName: typeof tip?.categoryName === 'string' ? tip.categoryName.trim() : null,
            imageUrl: typeof tip?.imageUrl === 'string' ? tip.imageUrl.trim() : null,
            url: typeof tip?.url === 'string' ? tip.url.trim() : null,
          };
        })
        .filter((tip: ServiceTip | null): tip is ServiceTip => tip != null);
    } catch {
      return [];
    }
  },
};
