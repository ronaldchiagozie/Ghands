import { clusterProviders, type ServiceProvider } from '@/components/ServiceMap';

const provider = (id: string, latitude: number, longitude: number): ServiceProvider => ({
  id,
  name: `Provider ${id}`,
  category: 'All',
  rating: null,
  reviews: 0,
  distance: '1 km',
  verified: true,
  coords: { latitude, longitude },
});

/** A city-block-sized view: each grid cell is about 0.0005 degrees, ~55m. */
const closeUp = { latitude: 6.5, longitude: 3.37, latitudeDelta: 0.004, longitudeDelta: 0.004 };
/** A whole-city view, where a cell covers kilometres. */
const wideOut = { latitude: 6.5, longitude: 3.37, latitudeDelta: 0.4, longitudeDelta: 0.4 };

describe('grouping providers on the map', () => {
  /**
   * The behaviour this exists for: a street of electricians used to draw as a
   * stack of overlapping 56pt avatars, where only the last one painted could
   * be read or tapped.
   */
  it('draws providers in the same spot as one numbered pin', () => {
    const clusters = clusterProviders(
      [
        provider('a', 6.5001, 3.3701),
        provider('b', 6.50012, 3.37012),
        provider('c', 6.50014, 3.37014),
      ],
      wideOut,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].providers).toHaveLength(3);
    /** The pin sits between them, not on whichever one happened to be first. */
    expect(clusters[0].coords.latitude).toBeCloseTo(6.50012, 4);
  });

  /** Zooming in has to take the group apart again, or it never opens. */
  it('separates them once the view is close enough', () => {
    const providers = [provider('a', 6.5, 3.37), provider('b', 6.52, 3.39)];

    expect(clusterProviders(providers, wideOut)).toHaveLength(1);
    expect(clusterProviders(providers, closeUp)).toHaveLength(2);
  });

  it('keeps a lone provider as themselves, with their own id', () => {
    const clusters = clusterProviders([provider('a', 6.5, 3.37)], wideOut);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].key).toBe('a');
    expect(clusters[0].providers).toHaveLength(1);
  });

  /** A provider the server sent without a position is left off, never placed at 0,0. */
  it('drops providers with no usable coordinates', () => {
    const broken = { ...provider('x', 0, 0), coords: { latitude: NaN, longitude: 3.37 } };

    expect(clusterProviders([broken as ServiceProvider, provider('a', 6.5, 3.37)], wideOut)).toHaveLength(1);
  });

  it('still draws something before the first region arrives', () => {
    expect(clusterProviders([provider('a', 6.5, 3.37), provider('b', 6.5, 3.37)], null)).toHaveLength(2);
  });
});
