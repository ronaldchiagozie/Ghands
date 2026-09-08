import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  Colors,
  BorderRadius,
  useTabScreenBottomSpacerHeight,
  useTabScrollContentPaddingTop,
} from '@/lib/designSystem';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowUpRight, LayoutGrid, MapPin, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useUserLocation } from '@/hooks/useUserLocation';
import ServiceMap, { type ServiceProvider } from '@/components/ServiceMap';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  authService,
  discoverService,
  locationService,
  providerService,
  serviceRequestService,
  type PopularServices,
  type ServiceCategory as ApiServiceCategory,
  type ServiceTip,
} from '@/services/api';

type Coords = { latitude: number; longitude: number };

/** Enough pins to read as a neighbourhood, few enough to still read as a map. */
const MAP_PROVIDER_LIMIT = 40;
const MAP_RADIUS_KM = 10;

/**
 * Names the section after the question the server actually answered.
 *
 * The ranking widens when an area has too little booking history to say
 * anything true, and it reports how far it had to go. Writing "Popular near
 * you" over national numbers would be the one thing this section must never
 * do, so the heading follows the scope rather than the intent.
 */
function popularHeading(popular: PopularServices | null): string {
  if (!popular) return 'Popular near you';
  const place = popular.scopeLabel?.trim();
  if (popular.scope === 'area') return place ? `Popular in ${place}` : 'Popular near you';
  return place ? `Popular in ${place}` : 'Popular services';
}

const formatNaira = (amount: number): string => `₦${Math.round(amount).toLocaleString('en-NG')}`;

export default function DiscoverScreen() {
  const router = useRouter();
  const tabScrollTop = useTabScrollContentPaddingTop(10);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { location } = useUserLocation();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [categories, setCategories] = useState<ApiServiceCategory[]>([]);
  const [popular, setPopular] = useState<PopularServices | null>(null);
  const [tips, setTips] = useState<ServiceTip[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);

  const noopMapCategory = useCallback((_category: string) => {}, []);
  const noopProviderSelect = useCallback(() => {}, []);
  const noopToggleList = useCallback(() => {}, []);
  const noopServiceLocationChange = useCallback(() => {}, []);

  const bottomSpacerHeight = useTabScreenBottomSpacerHeight(14);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  /**
   * The real category list, not four names typed into this file.
   *
   * The hardcoded row could not learn about a new trade, so it was guaranteed
   * to drift from the Categories tab the first time anybody added one.
   */
  const loadCategories = useCallback(async () => {
    try {
      const list = await serviceRequestService.getCategories();
      setCategories(Array.isArray(list) ? list : []);
    } catch {
      /* the row simply does not appear */
    }
  }, []);

  const loadTips = useCallback(async () => {
    setTips(await discoverService.getTips(3));
  }, []);

  /**
   * Everything that depends on where they are.
   *
   * The customer's saved service address, not a hardcoded point in Lagos. This
   * screen used to centre its map on Victoria Island for everybody in the
   * country and call the section "Popular Near You".
   */
  const loadNearby = useCallback(async () => {
    try {
      const userId = await authService.getUserId();
      if (!userId) return;

      const saved = await locationService.getUserLocation(userId);
      const latitude = Number(saved?.latitude);
      const longitude = Number(saved?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const point = { latitude, longitude };
      setCoords(point);

      const [popularResult, nearbyResult] = await Promise.all([
        discoverService.getPopular(latitude, longitude, MAP_RADIUS_KM),
        /**
         * No category on purpose. Discover browses before a trade has been
         * chosen, and the endpoint now returns every category when it is left
         * off rather than refusing the call.
         */
        providerService.getNearbyProviders(null, latitude, longitude, MAP_RADIUS_KM, MAP_PROVIDER_LIMIT),
      ]);

      setPopular(popularResult);
      setProviders(
        (nearbyResult ?? [])
          /** Only real positions. A provider without one is left off, never placed. */
          .filter((provider) => Number.isFinite(provider.latitude) && Number.isFinite(provider.longitude))
          .map((provider) => ({
            id: String(provider.id),
            providerId: provider.id,
            name: provider.name,
            category: 'All',
            rating: typeof provider.rating === 'number' ? provider.rating : null,
            reviews: provider.reviewCount ?? 0,
            distance: `${provider.distanceKm.toFixed(1)} km`,
            verified: provider.verified,
            isOnline: provider.isOnline,
            imageUri: provider.profileImageUrl ?? null,
            coords: {
              latitude: provider.latitude as number,
              longitude: provider.longitude as number,
            },
          })),
      );
    } catch {
      /* the location-dependent sections stay hidden */
    }
  }, []);

  useEffect(() => {
    void loadCategories();
    void loadTips();
  }, [loadCategories, loadTips]);

  useFocusEffect(
    useCallback(() => {
      void loadNearby();
    }, [loadNearby]),
  );

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      haptics.light();
      router.push({
        pathname: '/(tabs)/categories',
        params: { selectedCategoryId: categoryId },
      });
    },
    [router],
  );

  const handleTipPress = useCallback((tip: ServiceTip) => {
    const url = tip.url?.trim();
    if (!url) return;
    haptics.light();
    void Linking.openURL(url).catch(() => {
      /* nothing to say that the browser has not already said */
    });
  }, []);

  const animatedStyles = useMemo(
    () => ({ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }),
    [fadeAnim, slideAnim],
  );

  const browseCategories = useMemo(
    () => categories.filter((category) => category.name?.trim()).slice(0, 12),
    [categories],
  );

  return (
    <SafeAreaWrapper tabletShellTop>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[animatedStyles, { flex: 1, paddingTop: tabScrollTop }]}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.3,
              }}
            >
              Discover
            </Text>
          </View>

          {/**
            * Popular, from real bookings.
            *
            * Hidden entirely when there is nothing to say. A section that
            * announces popularity and then shows nothing is worse than a
            * section that is not there.
            */}
          {popular && popular.items.length > 0 ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Users size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                    letterSpacing: -0.2,
                  }}
                >
                  {popularHeading(popular)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 11.5,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginBottom: 14,
                  marginLeft: 25,
                }}
              >
                {`Booked most in the last ${popular.windowDays} days`}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {popular.items.map((item) => {
                  const Icon = getCategoryIcon(item.displayName);
                  return (
                    <TouchableOpacity
                      key={item.categoryName}
                      onPress={() => handleCategoryPress(item.categoryName)}
                      activeOpacity={0.85}
                      style={{
                        width: 168,
                        marginRight: 10,
                        borderRadius: BorderRadius.default,
                        padding: 14,
                        backgroundColor: Colors.white,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      <Icon />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          fontFamily: 'Poppins-SemiBold',
                          color: Colors.textPrimary,
                          letterSpacing: -0.2,
                          marginTop: 10,
                        }}
                      >
                        {item.displayName}
                      </Text>

                      {/**
                        * What actually makes it popular, rather than the word.
                        * Providers available comes from the same online rule
                        * the map uses, so the two cannot disagree.
                        */}
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'Poppins-Medium',
                          color: Colors.textSecondaryDark,
                          marginTop: 3,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {`${item.bookings.toLocaleString('en-NG')} booked · ${item.providersAvailable} available`}
                      </Text>

                      {/** Only when the server had enough quotes to be honest. */}
                      {item.medianPrice != null ? (
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontFamily: 'Poppins-Medium',
                            color: Colors.accent,
                            marginTop: 8,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {`Typically ${formatNaira(item.medianPrice)}`}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Every category, from the same list the Categories tab reads. */}
          {browseCategories.length > 0 ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <LayoutGrid size={18} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                    letterSpacing: -0.2,
                  }}
                >
                  Browse services
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {browseCategories.map((category) => {
                  /**
                    * The label people read and the value the next screen
                    * matches on are different fields, and mixing them up is
                    * how a tap lands on the wrong trade.
                    */
                  const name = category.name?.trim() || '';
                  const label = category.displayName?.trim() || name;
                  const Icon = getCategoryIcon(label);
                  return (
                    <TouchableOpacity
                      key={String(category.id ?? name)}
                      onPress={() => handleCategoryPress(name)}
                      activeOpacity={0.85}
                      style={{
                        width: 96,
                        marginRight: 10,
                        alignItems: 'center',
                        paddingVertical: 8,
                      }}
                    >
                      <Icon />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'Poppins-SemiBold',
                          color: Colors.textPrimary,
                          textAlign: 'center',
                          marginTop: 8,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/**
            * The map, with real providers on it.
            *
            * Only once there is a saved address to centre on. It used to render
            * with an empty provider list on a hardcoded Lagos coordinate under
            * a heading promising both popularity and proximity.
            */}
          {coords ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <MapPin size={16} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                    letterSpacing: -0.2,
                  }}
                >
                  {providers.length > 0
                    ? `${providers.length} providers near you`
                    : 'Providers near you'}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: Colors.backgroundGray,
                  borderRadius: BorderRadius.default,
                  overflow: 'hidden',
                }}
              >
                <View style={{ height: 260 }}>
                  <ErrorBoundary
                    fallback={
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: Colors.backgroundGray,
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 16,
                        }}
                      >
                        <MapPin size={28} color={Colors.textSecondaryDark} />
                        <Text
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            fontFamily: 'Poppins-Medium',
                            color: Colors.textSecondaryDark,
                            textAlign: 'center',
                          }}
                        >
                          Map preview unavailable. Check your connection and try again.
                        </Text>
                      </View>
                    }
                  >
                    <ServiceMap
                      providers={providers}
                      selectedCategory="All"
                      onCategoryChange={noopMapCategory}
                      selectedProviders={[]}
                      onProviderSelect={noopProviderSelect}
                      showList={false}
                      onToggleList={noopToggleList}
                      userLocation={coords}
                      categories={['All']}
                      serviceLocation={location || 'Your current area'}
                      onServiceLocationChange={noopServiceLocationChange}
                    />
                  </ErrorBoundary>
                </View>
              </View>
            </View>
          ) : null}

          {/**
            * Tips, written by somebody rather than typed into this file.
            *
            * Each one opens a page on the website. They are links now, and they
            * look like links, which they did not when they were three fixed
            * sentences that went nowhere.
            */}
          {tips.length > 0 ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
                  marginBottom: 14,
                }}
              >
                Service tips
              </Text>
              {tips.map((tip, index) => (
                <TouchableOpacity
                  key={tip.id}
                  onPress={() => handleTipPress(tip)}
                  activeOpacity={tip.url ? 0.85 : 1}
                  disabled={!tip.url}
                  accessibilityRole={tip.url ? 'link' : undefined}
                  style={{
                    backgroundColor: Colors.white,
                    borderRadius: BorderRadius.default,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 16,
                    marginBottom: index < tips.length - 1 ? 10 : 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: 'Poppins-SemiBold',
                          color: Colors.textPrimary,
                          letterSpacing: -0.2,
                          lineHeight: 21,
                          marginBottom: 5,
                        }}
                      >
                        {tip.title}
                      </Text>
                      {tip.body ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            fontSize: 11.5,
                            fontFamily: 'Poppins-Regular',
                            color: Colors.textSecondaryDark,
                            lineHeight: 18,
                          }}
                        >
                          {tip.body}
                        </Text>
                      ) : null}
                    </View>

                    {/** Shown only when there is somewhere to go. */}
                    {tip.url ? (
                      <ArrowUpRight size={17} color={Colors.textSecondaryDark} strokeWidth={2.2} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ height: bottomSpacerHeight }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
