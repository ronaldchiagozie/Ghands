import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  Colors,
  BorderRadius,
  useTabScreenBottomSpacerHeight,
  useTabScrollContentPaddingTop,
} from '@/lib/designSystem';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MapPin, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useUserLocation } from '@/hooks/useUserLocation';
import ServiceMap from '@/components/ServiceMap';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface TrendingService {
  id: string;
  title: string;
  category: string;
  bookings: number;
  image: any;
  categoryId: string;
}

interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  discount: string;
  expiry: string;
  image: any;
}

interface ServiceTip {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
}

/** Saved location is a string (address); map always needs lat/lng (see useUserLocation). */
const DISCOVER_MAP_CENTER = { latitude: 6.5244, longitude: 3.3794 };

// Removed colorful service icons and colors - using neutral design

const trendingServices: TrendingService[] = [
  {
    id: 'trend-1',
    title: 'Plumbing',
    category: 'Emergency Repairs',
    bookings: 245,
    image: require('../../assets/images/plumbericon2.png'),
    categoryId: 'plumber',
  },
  {
    id: 'trend-2',
    title: 'Electrical',
    category: 'Installations',
    bookings: 189,
    image: require('../../assets/images/electricianicon2.png'),
    categoryId: 'electrician',
  },
  {
    id: 'trend-3',
    title: 'Cleaning',
    category: 'Deep Cleaning',
    bookings: 312,
    image: require('../../assets/images/cleanericon2.png'),
    categoryId: 'cleaning',
  },
  {
    id: 'trend-4',
    title: 'Painting',
    category: 'Interior',
    bookings: 156,
    image: require('../../assets/images/paintericon2.png'),
    categoryId: 'painter',
  },
];

const specialOffers: SpecialOffer[] = [
  {
    id: 'offer-1',
    title: 'Weekend Special',
    description: 'Get 20% off on all weekend bookings',
    discount: '20% OFF',
    expiry: 'Ends in 2 days',
    image: require('../../assets/images/plumbericon2.png'),
  },
  {
    id: 'offer-2',
    title: 'First Time Customer',
    description: 'Enjoy 25% discount on your first service',
    discount: '25% OFF',
    expiry: 'Limited time',
    image: require('../../assets/images/electricianicon2.png'),
  },
];

const serviceTips: ServiceTip[] = [
  {
    id: 'tip-1',
    title: 'How to Choose the Right Plumber',
    description: 'Learn what to look for when hiring a plumbing professional',
    category: 'Plumbing',
    readTime: '3 min read',
  },
  {
    id: 'tip-2',
    title: 'Electrical Safety Tips for Homeowners',
    description: 'Essential safety guidelines for electrical work in your home',
    category: 'Electrical',
    readTime: '5 min read',
  },
  {
    id: 'tip-3',
    title: 'When to Call a Professional',
    description: 'Know when DIY is safe and when to call the experts',
    category: 'General',
    readTime: '4 min read',
  },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const tabScrollTop = useTabScrollContentPaddingTop(10);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { location } = useUserLocation();

  const noopMapCategory = useCallback((_category: string) => {}, []);
  const noopProviderSelect = useCallback(() => {}, []);
  const noopToggleList = useCallback(() => {}, []);
  const noopServiceLocationChange = useCallback(() => {}, []);

  const bottomSpacerHeight = useTabScreenBottomSpacerHeight(14);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleServicePress = useCallback((categoryId: string) => {
    haptics.light();
    router.push({
      pathname: '/(tabs)/categories',
      params: { selectedCategoryId: categoryId },
    });
  }, [router]);

  const handleOfferPress = useCallback((offerId: string) => {
    haptics.light();
    router.push({
      pathname: '/(tabs)/categories',
    });
  }, [router]);

  const animatedStyles = useMemo(() => ({
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  }), [fadeAnim, slideAnim]);

  return (
    <SafeAreaWrapper tabletShellTop>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={[animatedStyles, { flex: 1, paddingTop: tabScrollTop }]}>
          {/* Header Section */}
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

          {/* Hero Banner - Featured Deal/Provider */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleOfferPress('hero-offer')}
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.xl,
                padding: 18,
                elevation: 0,
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: BorderRadius.full,
                    backgroundColor: Colors.backgroundGray,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="gift" size={22} color={Colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      marginBottom: 4,
                      letterSpacing: -0.2,
                    }}
                  >
                    Featured Deal
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      lineHeight: 20,
                    }}
                  >
                    Get 30% off your first booking
                  </Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: Colors.black,
                  borderRadius: BorderRadius.default,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  alignSelf: 'flex-start',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.white,
                    letterSpacing: 0.2,
                  }}
                >
                  Claim Offer →
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Trending Services */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <TrendingUp size={18} color={Colors.textPrimary} style={{ marginRight: 8 }} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Trending Services
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {trendingServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  onPress={() => handleServicePress(service.categoryId)}
                  activeOpacity={0.85}
                  style={{
                    width: 170,
                    marginRight: 10,
                    borderRadius: BorderRadius.xl,
                    padding: 16,
                    backgroundColor: Colors.white,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    elevation: 0,
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: BorderRadius.default,
                      backgroundColor: Colors.backgroundGray,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {(() => {
                      const IconComponent = getCategoryIcon(service.title);
                      return <IconComponent />;
                    })()}
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      marginBottom: 4,
                      letterSpacing: -0.2,
                    }}
                  >
                    {service.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      marginBottom: 12,
                      lineHeight: 16,
                    }}
                  >
                    {service.category}
                  </Text>
                  <View
                    style={{
                      backgroundColor: Colors.backgroundGray,
                      borderRadius: BorderRadius.sm,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: 'Poppins-Medium',
                        color: Colors.textSecondaryDark,
                        letterSpacing: 0.1,
                      }}
                    >
                      {service.bookings} bookings
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Special Offers */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Special Offers
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {specialOffers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  onPress={() => handleOfferPress(offer.id)}
                  activeOpacity={0.9}
                  style={{
                    width: 260,
                    marginRight: 10,
                    backgroundColor: Colors.black,
                    borderRadius: BorderRadius.xl,
                    padding: 18,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: 'Poppins-Bold',
                          color: Colors.white,
                          marginBottom: 6,
                          letterSpacing: -0.2,
                        }}
                      >
                        {offer.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: 'Poppins-Regular',
                          color: 'rgba(255, 255, 255, 0.8)',
                          lineHeight: 18,
                        }}
                      >
                        {offer.description}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        backgroundColor: Colors.accent,
                        borderRadius: BorderRadius.sm,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Bold',
                          color: Colors.black,
                          letterSpacing: 0.2,
                        }}
                      >
                        {offer.discount}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: 'Poppins-Regular',
                        color: 'rgba(255, 255, 255, 0.7)',
                        letterSpacing: 0.1,
                      }}
                    >
                      {offer.expiry}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Service Tips */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Service Tips
              </Text>
            </View>
            {serviceTips.map((tip, index) => (
              <TouchableOpacity
                key={tip.id}
                activeOpacity={0.8}
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.xl,
                  padding: 16,
                  marginBottom: index < serviceTips.length - 1 ? 12 : 0,
                  elevation: 0,
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: 'Poppins-SemiBold',
                        color: Colors.textPrimary,
                        marginBottom: 6,
                        letterSpacing: -0.2,
                        lineHeight: 22,
                      }}
                    >
                      {tip.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Poppins-Regular',
                        color: Colors.textSecondaryDark,
                        marginBottom: 10,
                        lineHeight: 18,
                      }}
                    >
                      {tip.description}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: Colors.backgroundGray,
                          borderRadius: BorderRadius.sm,
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          marginRight: 10,
                          borderWidth: 0,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontFamily: 'Poppins-Medium',
                            color: Colors.textSecondaryDark,
                            letterSpacing: 0.2,
                          }}
                        >
                          {tip.category}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: 'Poppins-Regular',
                          color: Colors.textTertiary,
                        }}
                      >
                        {tip.readTime}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginTop: 1 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nearby Popular Services */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <MapPin size={16} color={Colors.textPrimary} style={{ marginRight: 8 }} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Popular Near You
              </Text>
            </View>
            <View
              style={{
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.xl,
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
                        Map preview unavailable. Check Google Maps API key, network, and try again.
                      </Text>
                    </View>
                  }
                >
                  <ServiceMap
                    providers={[]}
                    selectedCategory="All"
                    onCategoryChange={noopMapCategory}
                    selectedProviders={[]}
                    onProviderSelect={noopProviderSelect}
                    showList={false}
                    onToggleList={noopToggleList}
                    userLocation={DISCOVER_MAP_CENTER}
                    categories={['All']}
                    serviceLocation={location || 'Your current area'}
                    onServiceLocationChange={noopServiceLocationChange}
                  />
                </ErrorBoundary>
              </View>
            </View>
          </View>

          <View style={{ height: bottomSpacerHeight }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
