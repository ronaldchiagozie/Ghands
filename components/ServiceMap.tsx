import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Search, Star } from 'lucide-react-native';
import { BorderRadius, Colors, MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';

import { MAP_PROVIDER } from '@/lib/mapProvider';
import mapStyle from '@/lib/mapStyle';
import { AvatarCircle } from '@/components/AvatarCircle';

export type ProviderCategory = 'Plumber' | 'Electrician' | 'Car Wash' | 'Mechanic' | string;

export type ServiceProvider = {
  id: string;
  providerId?: number; // Real backend provider ID for API calls
  name: string;
  category: ProviderCategory;
  /** Null until the API returns one - never a stand-in value. */
  rating: number | null;
  reviews: number;
  distance: string;
  /** Admin approval. Not availability: that is isOnline. */
  verified: boolean;
  /** The provider's own online/offline toggle, now that one exists. */
  isOnline?: boolean;
  /**
   * The provider's photo, from `profileImageUrl` on `/api/provider/nearby` (the
   * server falls back to their first work photo when no profile photo is set).
   * Null means they have no photo anywhere, and the avatar shows initials.
   */
  imageUri?: string | null;
  coords: {
    latitude: number;
    longitude: number;
  };
};

const CATEGORY_CHIPS: ProviderCategory[] = ['All',];

const DEFAULT_MAP_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3794,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const MAX_SELECTION = 3;

/**
 * How many cells the visible map is divided into, across and down.
 *
 * Providers in the same cell are drawn as one numbered pin. Eight is chosen
 * from the size of the thing being drawn rather than from the data: an avatar
 * pin is 56pt wide, a phone is about 390pt, so roughly seven fit across the
 * screen without touching. Dividing more finely leaves pins overlapping, which
 * is the state this replaces; dividing less lumps together providers on
 * genuinely different streets.
 */
const CLUSTER_GRID = 8;

export type ProviderCluster = {
  key: string;
  coords: { latitude: number; longitude: number };
  providers: ServiceProvider[];
};

/**
 * Groups providers that would land on top of each other at this zoom.
 *
 * Lagos has whole streets of electricians, and the map drew one 56pt avatar
 * per provider at their exact coordinates - so a busy area came out as a pile
 * of overlapping faces where only the last one drawn could be read or tapped,
 * and the count in the heading ("23 providers near you") was the only honest
 * indication of how many were there. A numbered pin says twenty-three where
 * twenty-three are, and opens into faces as you zoom in.
 *
 * Grid rather than distance-based clustering: it is one pass over the list
 * with no distance maths, which matters because it re-runs on every pan and
 * this map also renders inside a 260pt preview on the Discover tab.
 */
export function clusterProviders(
  providers: ServiceProvider[],
  region: Region | null,
): ProviderCluster[] {
  const valid = providers.filter(
    (provider) =>
      Number.isFinite(provider.coords?.latitude) && Number.isFinite(provider.coords?.longitude),
  );
  if (!region || valid.length < 2) {
    return valid.map((provider) => ({
      key: provider.id,
      coords: provider.coords,
      providers: [provider],
    }));
  }

  /** A floor on the cell size, so clustering stops once you are street-level. */
  const cellLat = Math.max(region.latitudeDelta / CLUSTER_GRID, 0.0004);
  const cellLng = Math.max(region.longitudeDelta / CLUSTER_GRID, 0.0004);

  const cells = new Map<string, ServiceProvider[]>();
  for (const provider of valid) {
    const key = `${Math.floor(provider.coords.latitude / cellLat)}:${Math.floor(
      provider.coords.longitude / cellLng,
    )}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(provider);
    else cells.set(key, [provider]);
  }

  return Array.from(cells.entries()).map(([key, group]) => {
    if (group.length === 1) {
      return { key: group[0].id, coords: group[0].coords, providers: group };
    }
    /** The pin sits at the middle of the group, not on one arbitrary member. */
    const latitude = group.reduce((sum, p) => sum + p.coords.latitude, 0) / group.length;
    const longitude = group.reduce((sum, p) => sum + p.coords.longitude, 0) / group.length;
    return { key: `cluster-${key}`, coords: { latitude, longitude }, providers: group };
  });
}

/** Numeric company id for API / ProviderDetailScreen (list id is often `provider-123`). */
export function getBackendProviderNumericId(p: ServiceProvider): number | null {
  if (p.providerId != null && !Number.isNaN(Number(p.providerId))) {
    return Number(p.providerId);
  }
  const str = String(p.id);
  const m = str.match(/^provider-(\d+)$/i);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(str, 10);
  return Number.isNaN(n) ? null : n;
}

export type ServiceMapProps = {
  /** The booking's location; the map settles on it once it is known. */
  focus?: { latitude: number; longitude: number } | null;
  providers: ServiceProvider[];
  selectedCategory: ProviderCategory;
  onCategoryChange: (category: ProviderCategory) => void;
  selectedProviders: ServiceProvider[];
  onProviderSelect: (provider: ServiceProvider) => void;
  showList: boolean;
  onToggleList: () => void;
  userLocation?: { latitude: number; longitude: number } | null;
  categories?: ProviderCategory[];
  serviceLocation?: string;
  onServiceLocationChange?: (location: string) => void;
};

const ServiceMap: React.FC<ServiceMapProps> = ({
  focus,
  providers,
  selectedCategory,
  onCategoryChange,
  selectedProviders,
  onProviderSelect,
  showList,
  onToggleList,
  userLocation,
  categories = CATEGORY_CHIPS,
  serviceLocation,
  onServiceLocationChange,
}) => {
  const router = useRouter();
  const [activeProvider, setActiveProvider] = useState<ServiceProvider | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState(serviceLocation || '');
  const bottomCardAnim = useRef(new Animated.Value(0)).current;

  const onServiceLocationChangeRef = useRef(onServiceLocationChange);
  onServiceLocationChangeRef.current = onServiceLocationChange;

  const filteredProviders = useMemo(() => {
    // Filter by category only
    if (selectedCategory === 'All') return providers;
    return providers.filter((provider) => provider.category === selectedCategory);
  }, [providers, selectedCategory]);

  // Sync locationSearchQuery with serviceLocation prop when it changes
  useEffect(() => {
    if (serviceLocation && serviceLocation !== locationSearchQuery) {
      setLocationSearchQuery(serviceLocation);
    }
  }, [serviceLocation]);

  useEffect(() => {
    onServiceLocationChangeRef.current?.(locationSearchQuery);
  }, [locationSearchQuery]);

  useEffect(() => {
    Animated.timing(bottomCardAnim, {
      toValue: activeProvider ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeProvider, bottomCardAnim]);

  const mapRef = useRef<MapView>(null);
  /** The visible area, so pins can be grouped at the zoom actually on screen. */
  const [region, setRegion] = useState<Region | null>(null);

  /**
   * Whether markers are still allowed to redraw themselves.
   *
   * A Marker with a custom child re-rasterises on every frame while this is
   * true, and that is the single most expensive thing on this screen - forty
   * avatars repainting continuously, which on a mid-range Android is a
   * visibly janky map and a warm phone. It has to start true so the remote
   * profile photos appear once they load, and it is turned off shortly after,
   * by which point they have.
   */
  const [tracksMarkerViews, setTracksMarkerViews] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksMarkerViews(false), 2500);
    return () => clearTimeout(timer);
  }, [providers]);

  const initialRegion: Region = useMemo(() => {
    const center = focus ?? userLocation ?? providers[0]?.coords;
    const lat = center?.latitude;
    const lng = center?.longitude;
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    return {
      latitude: ok(lat) ? lat : DEFAULT_MAP_REGION.latitude,
      longitude: ok(lng) ? lng : DEFAULT_MAP_REGION.longitude,
      latitudeDelta: DEFAULT_MAP_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_MAP_REGION.longitudeDelta,
    };
  }, [focus, providers, userLocation]);

  const clusters = useMemo(
    () => clusterProviders(filteredProviders, region ?? initialRegion),
    [filteredProviders, region, initialRegion],
  );

  /** Zooms into a group rather than opening a card for twelve people at once. */
  const handleClusterPress = (cluster: ProviderCluster) => {
    setActiveProvider(null);
    mapRef.current?.fitToCoordinates(
      cluster.providers.map((provider) => provider.coords),
      { edgePadding: { top: 120, right: 70, bottom: 170, left: 70 }, animated: true },
    );
  };

  /**
   * The map now shows while the location and providers are still loading, so
   * it opens on a default spot and has to move once they arrive: to the
   * booking's location, then out far enough to take in the providers found.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [
      ...(focus ? [focus] : []),
      ...providers.map((p) => p.coords).filter((c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude)),
    ];
    if (points.length === 0) return;
    if (points.length === 1) {
      map.animateToRegion(
        {
          latitude: points[0].latitude,
          longitude: points[0].longitude,
          latitudeDelta: DEFAULT_MAP_REGION.latitudeDelta,
          longitudeDelta: DEFAULT_MAP_REGION.longitudeDelta,
        },
        450,
      );
      return;
    }
    map.fitToCoordinates(points, {
      edgePadding: { top: 160, right: 60, bottom: 260, left: 60 },
      animated: true,
    });
  }, [focus, providers]);

  const handleSelectProvider = (provider: ServiceProvider) => {
    const isAlreadySelected = selectedProviders.some((p) => p.id === provider.id);
    if (!isAlreadySelected && selectedProviders.length >= MAX_SELECTION) {
      onProviderSelect(provider);
      return;
    }
    onProviderSelect(provider);
  };

  const activeSelected = activeProvider
    ? selectedProviders.some((p) => p.id === activeProvider.id)
    : false;

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={MAP_PROVIDER}
        userInterfaceStyle="light"
        showsPointsOfInterest={false}
        showsUserLocation={Platform.OS === 'ios'}
        showsMyLocationButton={Platform.OS === 'ios'}
        customMapStyle={mapStyle as any}
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        onPress={() => setActiveProvider(null)}
      >
          {clusters.map((cluster) => {
            if (cluster.providers.length > 1) {
              /**
                * A group, drawn as how many are in it. Tapping it zooms in
                * until it comes apart into faces.
                */
              const size = cluster.providers.length > 9 ? 52 : 46;
              return (
                <Marker
                  key={cluster.key}
                  coordinate={cluster.coords}
                  tracksViewChanges={tracksMarkerViews}
                  onPress={() => handleClusterPress(cluster)}
                  accessibilityLabel={`${cluster.providers.length} providers here. Zoom in to see them.`}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: Colors.accent,
                      borderWidth: 3,
                      borderColor: Colors.white,
                      ...SURFACE_STYLES.homeTile,
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontSize: cluster.providers.length > 99 ? 14 : 16,
                        fontFamily: 'Poppins-Bold',
                        color: Colors.white,
                      }}
                    >
                      {cluster.providers.length > 99 ? '99+' : cluster.providers.length}
                    </Text>
                  </View>
                </Marker>
              );
            }

            const provider = cluster.providers[0];
            return (
              <Marker
                key={cluster.key}
                coordinate={provider.coords}
                tracksViewChanges={tracksMarkerViews}
                onPress={() => setActiveProvider(provider)}
              >
                {/**
                  * The marker is the person, not their trade. It used to be a
                  * trade icon drawn from a map of four categories, so every
                  * provider outside those four - tilers, roofers, cleaners -
                  * appeared on the map as a plumber.
                  */}
                <View
                  className="items-center justify-center bg-white rounded-full"
                  style={{ width: 56, height: 56, ...SURFACE_STYLES.homeTile }}
                >
                  <AvatarCircle
                    uri={provider.imageUri}
                    name={provider.name}
                    size={48}
                    borderColor="transparent"
                  />
                </View>
              </Marker>
            );
          })}
      </MapView>

      <View className="absolute top-4 left-0 right-0 px-4">
        {/* Location Search Input */}
        <View
          style={{
            ...SURFACE_STYLES.searchField,
            backgroundColor: Colors.white,
            borderRadius: BorderRadius.xl,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Search size={20} color={Colors.textSecondaryDark} style={{ marginRight: 12 }} />
          <TextInput
            placeholder="Where do you need service?"
            placeholderTextColor={Colors.placeholder}
            value={locationSearchQuery}
            onChangeText={setLocationSearchQuery}
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textPrimary,
            }}
          />
          {locationSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setLocationSearchQuery('')}
              activeOpacity={0.7}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: Colors.backgroundGray,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textSecondaryDark,
                }}
              >
                ×
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Chips and Toggle */}
        <View className="flex-row items-center justify-between">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16, gap: 8 }}
          >
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => {
                    onCategoryChange(category);
                    setActiveProvider(null);
                  }}
                  activeOpacity={0.85}
                  className={`rounded-full px-4 py-2 ${isActive ? 'bg-[#FF8A34]' : 'bg-white'}`}
                  style={isActive ? { borderWidth: 0 } : SURFACE_STYLES.homeTile}
                >
                  <Text
                    className={`text-sm ${isActive ? 'text-white' : 'text-gray-700'}`}
                    style={{ fontFamily: 'Poppins-SemiBold' }}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => onToggleList?.()}
            activeOpacity={0.85}
            className="rounded-full bg-green-500 px-4 py-2"
            style={{ borderWidth: 0 }}
          >
            <Text className="text-sm text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
              {showList ? 'Hide list' : 'View list'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showList && (
        <View className="absolute inset-x-0 bottom-2 pb-6">
          <View
            className="mx-2 rounded-3xl bg-white p-4"
            style={SURFACE_STYLES.floatingSheet}
          >
            <View className="w-12 h-1.5 bg-gray-200 self-center rounded-full mb-4" />
            {/**
              * Spacing set as a style, not a class. The cards used mb-3 with a
              * last:mb-0 variant, which React Native does not reliably apply, so
              * the list could render as one block of cards touching each other.
              */}
            <ScrollView
              style={{ maxHeight: Platform.select({ ios: 380, android: 350 }) }}
              contentContainerStyle={{ gap: 12, paddingBottom: 2 }}
              showsVerticalScrollIndicator={false}
            >
              {filteredProviders.map((provider) => {
                const isSelected = selectedProviders.some((p) => p.id === provider.id);
                return (
                  <TouchableOpacity
                    key={`list-${provider.id}`}
                    onPress={() => {
                      setActiveProvider(provider);
                    }}
                    onLongPress={() => {
                      const numericId = getBackendProviderNumericId(provider);
                      if (numericId == null) return;
                      router.push({
                        pathname: '/ProviderDetailScreen',
                        params: {
                          providerName: provider.name,
                          providerId: String(numericId),
                          initialRating: String(provider.rating ?? ''),
                          initialReviewCount: String(provider.reviews ?? ''),
                          /** The photo the pin is already drawing; see ProviderDetailScreen. */
                          initialImage: provider.imageUri ?? '',
                        },
                      } as any);
                    }}
                    activeOpacity={0.9}
                  >
                    <View
                      className="flex-row items-center bg-white rounded-2xl px-3 py-3"
                      style={SURFACE_STYLES.homeTile}
                    >
                      <AvatarCircle
                        uri={provider.imageUri}
                        name={provider.name}
                        size={54}
                        style={{ marginRight: 12 }}
                      />
                      <View className="flex-1">
                        <Text className="text-base text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                          {provider.name}
                        </Text>
                        <Text className="text-xs text-gray-500" style={{ fontFamily: 'Poppins-Medium' }}>
                          {provider.category} • {provider.distance}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <Star size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                          <Text className="text-xs text-gray-500 ml-1" style={{ fontFamily: 'Poppins-Medium' }}>
                            {provider.rating != null
                              ? `${provider.rating.toFixed(1)} (${provider.reviews} reviews)`
                              : 'No reviews yet'}
                          </Text>
                          <View className="ml-2 rounded-full bg-[rgba(79,103,57,0.14)] px-2 py-0.5">
                            <Text className="text-xs text-[#166534]" style={{ fontFamily: 'Poppins-Medium' }}>
                              {provider.isOnline === false ? 'Offline' : 'Available'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelectProvider(provider)}
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isSelected ? 'bg-[#4F6739] border-[#4F6739]' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {activeProvider && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: showList ? 280 : 32,
            opacity: bottomCardAnim,
            transform: [
              {
                translateY: bottomCardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
          }}
        >
          <View className="bg-white rounded-3xl p-4" style={SURFACE_STYLES.homeCard}>
            <View className="flex-row items-center">
              <AvatarCircle
                uri={activeProvider.imageUri}
                name={activeProvider.name}
                size={60}
                style={{ marginRight: 14 }}
              />
              <View className="flex-1">
                <Text className="text-lg text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  {activeProvider.name}
                </Text>
                <Text className="text-sm text-gray-500" style={{ fontFamily: 'Poppins-Medium' }}>
                  {activeProvider.category} • {activeProvider.distance}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Star size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                  <Text className="text-xs text-gray-500 ml-1" style={{ fontFamily: 'Poppins-Medium' }}>
                    {activeProvider.rating != null
                      ? `${activeProvider.rating.toFixed(1)} (${activeProvider.reviews} reviews)`
                      : 'No reviews yet'}
                  </Text>
                  <View className="ml-2 rounded-full bg-[rgba(79,103,57,0.14)] px-2 py-0.5">
                    <Text className="text-xs text-[#166534]" style={{ fontFamily: 'Poppins-Medium' }}>
                      {activeProvider.isOnline === false ? 'Offline' : 'Available'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setActiveProvider(null)}
                style={{ marginLeft: 8, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: 999, backgroundColor: Colors.backgroundGray, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel="Close provider details"
              >
                <Text className="text-gray-500" style={{ fontFamily: 'Poppins-Bold' }}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                const numericId = getBackendProviderNumericId(activeProvider);
                if (numericId == null) return;
                router.push({
                  pathname: '/ProviderDetailScreen',
                  params: {
                    providerName: activeProvider.name,
                    providerId: String(numericId),
                    initialRating: String(activeProvider.rating ?? ''),
                    initialReviewCount: String(activeProvider.reviews ?? ''),
                    initialImage: activeProvider.imageUri ?? '',
                  },
                } as any);
              }}
              activeOpacity={0.85}
              className="mt-3 rounded-xl px-4 py-2.5 flex-row items-center justify-center bg-white"
              style={SURFACE_STYLES.homeTile}
            >
              <Text className="text-sm text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                View Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSelectProvider(activeProvider)}
              activeOpacity={0.85}
              className={`mt-2 rounded-xl px-4 py-3 flex-row items-center justify-center ${
                activeSelected ? 'bg-[#4F6739]' : 'bg-black'
              }`}
            >
              <Text className="text-sm text-white" style={{ fontFamily: 'Poppins-SemiBold' }}>
                {activeSelected ? 'Selected' : 'Select provider'} ({selectedProviders.length}/{MAX_SELECTION})
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default ServiceMap;

