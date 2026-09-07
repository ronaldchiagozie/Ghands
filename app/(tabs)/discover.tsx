import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  Colors,
  BorderRadius,
  useTabScreenBottomSpacerHeight,
  useTabScrollContentPaddingTop,
} from '@/lib/designSystem';
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
  image: any;
  categoryId: string;
}

interface ServiceTip {
  id: string;
  title: string;
  description: string;
  category: string;
}

/** Saved location is a string (address); map always needs lat/lng (see useUserLocation). */
const DISCOVER_MAP_CENTER = { latitude: 6.5244, longitude: 3.3794 };

// Removed colorful service icons and colors - using neutral design

const trendingServices: TrendingService[] = [
  {
    id: 'trend-1',
    title: 'Plumbing',
    category: 'Emergency Repairs',
    image: require('../../assets/images/plumbericon2.png'),
    categoryId: 'plumber',
  },
  {
    id: 'trend-2',
    title: 'Electrical',
    category: 'Installations',
    image: require('../../assets/images/electricianicon2.png'),
    categoryId: 'electrician',
  },
  {
    id: 'trend-3',
    title: 'Cleaning',
    category: 'Deep Cleaning',
    image: require('../../assets/images/cleanericon2.png'),
    categoryId: 'cleaning',
  },
  {
    id: 'trend-4',
    title: 'Painting',
    category: 'Interior',
    image: require('../../assets/images/paintericon2.png'),
    categoryId: 'painter',
  },
];

const serviceTips: ServiceTip[] = [
  {
    id: 'tip-1',
    title: 'How to Choose the Right Plumber',
    description: 'Learn what to look for when hiring a plumbing professional',
    category: 'Plumbing',
  },
  {
    id: 'tip-2',
    title: 'Electrical Safety Tips for Homeowners',
    description: 'Essential safety guidelines for electrical work in your home',
    category: 'Electrical',
  },
  {
    id: 'tip-3',
    title: 'When to Call a Professional',
    description: 'Know when DIY is safe and when to call the experts',
    category: 'General',
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

          {/* Services to browse */}
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
                Browse services
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
            {/**
              * Static advice, not articles. These were TouchableOpacity with a
              * chevron and a "3 min read", so they looked like links to writing
              * that does not exist — tapping one did nothing at all.
              */}
            {serviceTips.map((tip, index) => (
              <View
                key={tip.id}
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
                    </View>
                  </View>
                </View>
              </View>
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
