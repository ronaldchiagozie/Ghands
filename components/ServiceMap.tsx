import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
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

  const initialRegion: Region = useMemo(() => {
    const focus = userLocation ?? providers[0]?.coords;
    const lat = focus?.latitude;
    const lng = focus?.longitude;
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    return {
      latitude: ok(lat) ? lat : DEFAULT_MAP_REGION.latitude,
      longitude: ok(lng) ? lng : DEFAULT_MAP_REGION.longitude,
      latitudeDelta: DEFAULT_MAP_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_MAP_REGION.longitudeDelta,
    };
  }, [providers, userLocation]);

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
        style={{ flex: 1 }}
        provider={MAP_PROVIDER}
        userInterfaceStyle="light"
        showsPointsOfInterest={false}
        showsUserLocation={Platform.OS === 'ios'}
        showsMyLocationButton={Platform.OS === 'ios'}
        customMapStyle={mapStyle as any}
        initialRegion={initialRegion}
        onPress={() => setActiveProvider(null)}
      >
          {filteredProviders.map((provider) => (
            <Marker
              key={provider.id}
              coordinate={provider.coords}
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
          ))}
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
            contentContainerStyle={{ paddingRight: 16 }}
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
                  className={`mr-3 rounded-full px-4 py-2 ${isActive ? 'bg-[#FF8A34]' : 'bg-white'}`}
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
            <ScrollView style={{ maxHeight: Platform.select({ ios: 380, android: 350 }) }}>
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
                        },
                      } as any);
                    }}
                    activeOpacity={0.9}
                    className="mb-3 last:mb-0"
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

