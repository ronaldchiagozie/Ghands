import { CoachMarkTarget } from '@/components/CoachMarkTarget';
import AiSparkleFab from '@/components/home/AiSparkleFab';
import { CategoryChipSkeleton, JobCardSkeleton } from '@/components/LoadingSkeleton';
import { useSkeletonGate } from '@/hooks/useSkeletonGate';
import LocationSearchModal from '@/components/LocationSearchModal';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import type { JobActivity } from '@/components/home/JobActivityCard';
import JobActivityCard from '@/components/home/JobActivityCard';
// import PromoCodeCard from '@/components/home/PromoCodeCard';
import TodoCard from '@/components/home/TodoCard';
import { quickActions, todoItems, type QuickAction } from '@/components/home/data';
import useCoachMarks from '@/hooks/useCoachMarks';
import { haptics } from '@/hooks/useHaptics';
import { useTokenGuard } from '@/hooks/useTokenGuard';
import { useOnNetworkRestore } from '@/hooks/useNetworkConnectivity';
import { useUserLocation } from '@/hooks/useUserLocation';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, useReducedMotion, useTabScrollContentPaddingTop, useTabScreenBottomSpacerHeight } from '@/lib/designSystem';
import { SURFACE_STYLES, surfaceElevation } from '@/lib/surfaceStyles';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { ServiceRequest, serviceRequestService } from '@/services/api';
import { logDevAuthTokens } from '@/utils/devAuthTokens';
import { handleApiAuthFailure, runAuthSafe } from '@/utils/authRedirect';
import { getCategoryIcon, resolveCategoryImageSource } from '@/utils/categoryIcons';
import { isAuthError } from '@/utils/errors';
import { isConnectivityOrNetworkError } from '@/utils/isNetworkFailure';
import { resolveJobDisplayStatus } from '@/utils/jobDisplayStatus';
import { countSentQuotations, jobHasSentQuotation } from '@/utils/quotationStatus';
// import { shareReferral } from '@/utils/referral';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronDown, MapPin, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ServiceCategory } from '../../data/serviceCategories';

/** Deep olive: Quick actions panel + matching CTAs (pin, search, badges) on home. */
const HOME_QUICK_ACTIONS_PANEL_BG = Colors.accent;
const HOME_QUICK_ACTIONS_PANEL_BORDER = 'rgba(45, 65, 24, 0.72)';
/** Inner quick-action tiles: frosted on sage (pure white felt too loud). */
const HOME_QUICK_ACTION_TILE_BG = 'rgba(255, 255, 255, 0.16)';
const HOME_QUICK_ACTION_TILE_BORDER = 'rgba(255, 255, 255, 0.34)';
const HOME_QUICK_ACTION_LABEL = 'rgba(255, 255, 255, 0.96)';
/** Vertical gap between major home sections (Popular · Quick actions · Job activity). */
const HOME_SECTION_VERTICAL_GAP = 24;
/** Softer mint well for category icons (lighter than accent-tinted gray). */
const HOME_CATEGORY_ICON_WELL = '#F4F8EF';

const CategoryItem = React.memo(({
  category,
  onPress
}: {
  category: ServiceCategory;
  onPress: (category: ServiceCategory) => void;
}) => {
  const handlePress = useCallback(() => {
    onPress(category);
  }, [category, onPress]);

  const IconComponent = category.icon;

  return (
    <TouchableOpacity
      key={category.id}
      onPress={handlePress}
      activeOpacity={0.8}
      style={{
        width: 98,
        marginRight: 12,
        zIndex: 2,
        backgroundColor: Colors.white,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.055)',
        elevation: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: HOME_CATEGORY_ICON_WELL,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <IconComponent />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.textPrimary,
          textAlign: 'center',
        }}
      >
        {category.title}
      </Text>
    </TouchableOpacity>
  );
});

CategoryItem.displayName = 'CategoryItem';

const parseMoneyValue = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatNaira = (amount: number): string =>
  `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const HomeScreen = React.memo(() => {
  const router = useRouter();
  useTokenGuard();
  const [searchQuery, setSearchQuery] = useState('');
  const [apiCategories, setApiCategories] = useState<ServiceCategory[]>([]); // API categories
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const categoriesReadyRef = useRef(false);
  const jobsReadyRef = useRef(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { location, isLoading, refreshLocation } = useUserLocation();
  const [jobActivities, setJobActivities] = useState<JobActivity[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tour disabled - keep hook to avoid runtime errors, use empty steps so tour never shows
  useCoachMarks([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const categoriesFadeAnim = useRef(new Animated.Value(1)).current; // Start visible for dummy data
  const reducedMotion = useReducedMotion();

  // Dev-only: log client + provider tokens (cached on each login)
  useEffect(() => {
    void logDevAuthTokens('ClientHome');
  }, []);

  // Refresh location when modal closes
  useEffect(() => {
    if (!showLocationModal) {
      refreshLocation();
    }
  }, [showLocationModal, refreshLocation]);

  const animationConfig = useMemo(() => ({
    fadeConfig: {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    },
    slideConfig: {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }
  }), []);

  useEffect(() => {
    if (reducedMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, animationConfig.fadeConfig),
      Animated.timing(slideAnim, animationConfig.slideConfig),
    ]).start();
  }, [fadeAnim, slideAnim, animationConfig, reducedMotion]);

  // Helper function to format time ago
  const formatTimeAgo = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      } else {
        return 'Just now';
      }
    } catch {
      return 'Recently';
    }
  }, []);

  // Map ServiceRequest to JobActivity (priceFromQuotations = best total from quotes when request has no price)
  const mapRequestToJobActivity = useCallback((
    request: ServiceRequest,
    acceptedProvidersCount: number = 0,
    quotesCount: number = 0,
    priceFromQuotations?: number | null
  ): JobActivity => {
    const categoryDisplayName = request.categoryName
      ? request.categoryName.charAt(0).toUpperCase() + request.categoryName.slice(1).replace(/([A-Z])/g, ' $1')
      : 'Service';

    const apiStatus = ((request as any).status ?? '').toString().toLowerCase();
    const hasQuotationSent =
      quotesCount > 0 || jobHasSentQuotation(undefined, request as unknown as Record<string, unknown>);
    const status = resolveJobDisplayStatus(apiStatus, {
      acceptedProvidersCount,
      visitRequest: (request as any).visitRequest,
      hasQuotationSent,
    });

    const requestPrice = [
      (request as any).totalCost,
      (request as any).total_amount,
      (request as any).paymentAmount,
      (request as any).amount,
      (request as any).price,
      (request as any).total,
      (request as any).quotationTotal,
      (request as any).quoteTotal,
    ].map(parseMoneyValue).find((value) => value != null && value > 0);
    const price = requestPrice ?? priceFromQuotations;
    const priceRange = price != null && !isNaN(price) && price > 0 ? formatNaira(price) : 'Awaiting quote';

    return {
      id: request.id.toString(),
      title: request.jobTitle || `${categoryDisplayName} Service`,
      category: categoryDisplayName,
      submittedAt: formatTimeAgo(request.createdAt),
      quotes: quotesCount,
      priceRange,
      status,
    };
  }, [formatTimeAgo]);

  // Load job activities – after mapRequestToJobActivity
  const loadJobActivities = useCallback(async () => {
    if (!jobsReadyRef.current) {
      setIsLoadingJobs(true);
    }
    try {
      const requests = await serviceRequestService.getUserRequests();
      if (!Array.isArray(requests) || requests.length === 0) {
        setJobActivities([]);
        return;
      }
      const confirmedRequests = requests.filter((request) => {
        const hasJobTitle = request.jobTitle && request.jobTitle.trim().length > 0;
        const hasDescription = request.description && request.description.trim().length > 0;
        return hasJobTitle && hasDescription;
      });
      const activityEntries = await Promise.all(
        confirmedRequests.map(async (request) => {
          let acceptedProvidersCount = 0;
          let quotesCount = 0;
          let priceFromQuotations: number | null = null;
          try {
            const [acceptedProviders, quotations] = await Promise.all([
              serviceRequestService.getAcceptedProviders(request.id),
              serviceRequestService.getQuotations(request.id).catch(() => []),
            ]);
            acceptedProvidersCount = acceptedProviders?.length || 0;
            const qList = Array.isArray(quotations) ? quotations : [];
            const hasSent = jobHasSentQuotation(qList, request as unknown as Record<string, unknown>);
            quotesCount = countSentQuotations(qList) || (hasSent ? 1 : 0);
            const sentQuotes = qList.filter((q: any) => {
              if (q?.sentAt || q?.submittedAt) return true;
              if (q?.status && q.status !== 'draft') return true;
              if (q?.total != null && Number(q.total) > 0) return true;
              return false;
            });
            if (sentQuotes.length > 0) {
              const toNum = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : parseFloat(v));
              const accepted = sentQuotes.find((q: any) => q.status === 'accepted');
              if (accepted != null) {
                const t = toNum((accepted as any).total);
                if (!isNaN(t) && t >= 0) priceFromQuotations = t;
              }
              if (priceFromQuotations == null) {
                const totals = sentQuotes.map((q: any) => toNum(q.total));
                const validTotals = totals.filter((t) => !isNaN(t) && t >= 0);
                if (validTotals.length > 0) priceFromQuotations = Math.min(...validTotals);
              }
            }
          } catch (error) {
            if (isAuthError(error)) throw error;
            if (__DEV__) { /* backend schema error - continue */ }
          }
          const activity = mapRequestToJobActivity(request, acceptedProvidersCount, quotesCount, priceFromQuotations);
          const createdAtMs = request?.createdAt ? new Date(request.createdAt).getTime() : 0;
          return { activity, createdAtMs };
        })
      );
      const sortedActivities = activityEntries
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 2)
        .map((entry) => entry.activity);
      setJobActivities(sortedActivities);
    } catch (error: unknown) {
      if (await handleApiAuthFailure(error, router)) {
        return;
      }
      const isNetworkError = isConnectivityOrNetworkError(error);
      if (isNetworkError) {
        // Global offline overlay handles UI; keep cached list for reconnect.
        return;
      }
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) {
        await handleApiAuthFailure(error, router);
        return;
      }
      if (status === 500) {
        // Backend/server issue: keep user on screen and show empty state.
        // Do not redirect to auth flow for non-auth failures.
        if (__DEV__) console.warn('Job activities API returned 500; skipping redirect.');
      }
      if (__DEV__) console.error('Error loading job activities:', error);
      setJobActivities([]);
    } finally {
      jobsReadyRef.current = true;
      setIsLoadingJobs(false);
    }
  }, [mapRequestToJobActivity, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshLocation();
    await loadJobActivities();
    setRefreshing(false);
  }, [loadJobActivities, refreshLocation]);

  useFocusEffect(
    useCallback(() => {
      refreshLocation();
      runAuthSafe(() => loadJobActivities(), router);
    }, [refreshLocation, loadJobActivities, router])
  );

  // Fetch categories from API on mount
  useEffect(() => {
    runAuthSafe(() => loadCategoriesFromAPI(), router);
    runAuthSafe(() => loadJobActivities(), router);
  }, [loadJobActivities, router]);

  // Animate categories when API data loads
  useEffect(() => {
    if (apiCategories.length > 0) {
      if (reducedMotion) {
        categoriesFadeAnim.setValue(1);
        return;
      }

      Animated.sequence([
        Animated.timing(categoriesFadeAnim, {
          toValue: 0.7,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(categoriesFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [apiCategories, categoriesFadeAnim, reducedMotion]);

  // Shuffle array function for randomizing category order
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const loadCategoriesFromAPI = async () => {
    if (!categoriesReadyRef.current) {
      setIsLoadingCategories(true);
    }
    try {
      const categories = await serviceRequestService.getCategories();

      if (!Array.isArray(categories) || categories.length === 0) {
        // If API fails or returns empty, keep dummy data
        return;
      }

      // Map API categories to ServiceCategory format with icons
      const categoriesWithIcons: ServiceCategory[] = categories
        .map((cat: any) => {
          const hasBundledIcon = !!resolveCategoryImageSource(cat.name, cat.displayName, cat.description);
          const IconComponent = getCategoryIcon(cat.name, cat.displayName, cat.description);
          return {
            id: cat.name || cat.categoryName || cat.id || `category-${cat.name}`,
            title: cat.displayName || cat.name || 'Service',
            icon: IconComponent,
            hasBundledIcon,
          };
        });

      // Prioritize categories with proper bundled icons on home so the first row looks polished.
      const iconCategories = shuffleArray(categoriesWithIcons.filter((cat: any) => cat.hasBundledIcon));
      const fallbackCategories = shuffleArray(categoriesWithIcons.filter((cat: any) => !cat.hasBundledIcon));
      const prioritizedCategories = [...iconCategories, ...fallbackCategories];

      // Limit to 8 for home screen (same as dummy data)
      const limitedCategories = prioritizedCategories.slice(0, 8);

      // Replace dummy data with API data
      setApiCategories(limitedCategories);
    } catch (error: unknown) {
      if (await handleApiAuthFailure(error, router)) {
        return;
      }

      // On error, keep existing categories — global offline overlay covers connectivity loss.
      if (isConnectivityOrNetworkError(error)) {
        return;
      }

      setApiCategories([]);
      if (__DEV__) {
        console.error('Error loading categories from API:', error);
      }
    } finally {
      categoriesReadyRef.current = true;
      setIsLoadingCategories(false);
    }
  };

  useOnNetworkRestore(() => {
    refreshLocation();
    runAuthSafe(() => loadJobActivities(), router);
    runAuthSafe(() => loadCategoriesFromAPI(), router);
  });

  const handleCategoryPress = useCallback((category: ServiceCategory) => {
    router.push({
      pathname: '/(tabs)/categories',
      params: { selectedCategoryId: category.id },
    });
  }, [router]);

  const handleViewAllCategories = useCallback(() => {
    router.push('/(tabs)/categories' as any);
  }, [router]);

  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/(tabs)/categories',
        params: { searchQuery: searchQuery.trim() },
      });
    }
  }, [searchQuery, router]);

  const filteredCategories = useMemo(() => {
    const categoriesToUse = apiCategories.length > 0 ? apiCategories : [];

    if (!searchQuery.trim()) {
      return categoriesToUse;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = categoriesToUse.filter(
      (category) =>
        category.title.toLowerCase().includes(query) ||
        category.id.toLowerCase().includes(query)
    );
    return filtered;
  }, [searchQuery, apiCategories]);

  const handleNotificationPress = useCallback(() => {
    router.push('../NotificationsScreen' as any);
  }, [router]);

  const handleLocationPress = useCallback(() => {
    haptics.light();
    setShowLocationModal(true);
  }, []);

  const handleViewAllJobs = useCallback(() => {
    router.push('/(tabs)/jobs' as any);
  }, [router]);

  // Temporarily disabling home recommendations until we plug in real data
  const personalizedRecommendations: any[] = [];

  const animatedStyles = useMemo(() => ({
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }]
  }), [fadeAnim, slideAnim]);

  const searchBarStyle = useMemo(() => ({ height: 52 }), []);

  /** Clears the floating AI FAB (tab bar + 88pt). */
  const bottomSpacerHeight = useTabScreenBottomSpacerHeight(88);
  const tabScrollTop = useTabScrollContentPaddingTop(10);

  const { showSkeleton: showCategoriesSkeleton, isLoadingEmpty: isCategoriesLoadingEmpty } =
    useSkeletonGate(isLoadingCategories, filteredCategories.length === 0);
  const { showSkeleton: showJobsSkeleton, isLoadingEmpty: isJobsLoadingEmpty } =
    useSkeletonGate(isLoadingJobs, jobActivities.length === 0);

  return (
    <SafeAreaWrapper tabletShellTop>
      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={HOME_QUICK_ACTIONS_PANEL_BG}
            colors={[HOME_QUICK_ACTIONS_PANEL_BG] as unknown as string[]}
          />
        }
      >
        <Animated.View
          style={[animatedStyles, { flex: 1, paddingTop: tabScrollTop, overflow: 'visible' }]}
        >
          <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingTop: 0, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <CoachMarkTarget name="location-selector" style={{ flex: 1, marginRight: 8 }}>
                <TouchableOpacity
                  onPress={handleLocationPress}
                  activeOpacity={0.8}
                  accessibilityLabel={location ? `Location: ${location}` : 'Enter your location'}
                  accessibilityHint="Opens location search"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    backgroundColor: Colors.white,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    minHeight: 52,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: HOME_QUICK_ACTIONS_PANEL_BG,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                      shadowColor: '#0a1207',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.22,
                      shadowRadius: 4,
                      elevation: surfaceElevation(3),
                    }}
                  >
                    <MapPin size={18} color="#FFFFFF" />
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: location ? Colors.textPrimary : Colors.textSecondaryDark,
                      flex: 1,
                      marginRight: 4,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {location || 'Enter your location'}
                  </Text>
                  <ChevronDown size={18} color={location ? Colors.textSecondaryDark : Colors.textTertiary} />
                </TouchableOpacity>
              </CoachMarkTarget>
              <TouchableOpacity
                style={{ position: 'relative', padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={handleNotificationPress}
                activeOpacity={0.7}
              >
                <Bell size={22} color={Colors.textPrimary} />
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: HOME_QUICK_ACTIONS_PANEL_BG,
                  }}
                />
              </TouchableOpacity>
            </View>

            <CoachMarkTarget name="search-bar">
              <View
                className="bg-gray-100 rounded-xl px-4 py-0 flex-row items-center"
                style={[searchBarStyle, SURFACE_STYLES.searchField]}
              >
                <TextInput
                  placeholder="Search for services"
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  className="flex-1 text-black text-base"
                  placeholderTextColor={Colors.placeholder}
                  style={{ fontFamily: 'Poppins-Medium' }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                    activeOpacity={0.7}
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name='close-outline' size={20} color={Colors.textSecondaryDark} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 8, backgroundColor: HOME_QUICK_ACTIONS_PANEL_BG }}
                  onPress={handleSearch}
                  activeOpacity={0.8}
                  accessibilityLabel="Search"
                >
                  <Search size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </CoachMarkTarget>
          </View>
            <CoachMarkTarget name="categories-section" style={{ overflow: 'visible' }}>
            <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingTop: 16, marginBottom: HOME_SECTION_VERTICAL_GAP, overflow: 'visible' }}>
              <View style={{ flexDirection: 'row', paddingBottom: 0, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text
                  className="text-lg font-bold text-black"
                  style={{ fontFamily: 'Poppins-Bold', letterSpacing: -0.2 }}
                >
                  Popular services
                </Text>
                <TouchableOpacity
                  onPress={handleViewAllCategories}
                  className="px-3 py-1 flex-row items-center"
                >
                  <Text
                    className="text-sm text-black"
                    style={{ fontFamily: 'Poppins-SemiBold' }}
                  >
                    View all
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="black" />
                </TouchableOpacity>
              </View>

              <Animated.View style={{ opacity: categoriesFadeAnim, overflow: 'visible' }}>
                {(showCategoriesSkeleton || isCategoriesLoadingEmpty) ? (
                  // Skeleton line for categories when nothing is loaded yet - matches actual CategoryItem size
                  <View style={{ flexDirection: 'row', marginTop: 0, marginBottom: 0, paddingVertical: 6, overflow: 'visible' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <CategoryChipSkeleton key={i} />
                    ))}
                  </View>
                ) : filteredCategories.length === 0 ? null : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    removeClippedSubviews={false}
                    contentContainerStyle={{
                      paddingRight: 16,
                      paddingVertical: 6,
                      paddingLeft: 2,
                    }}
                    style={{
                      marginTop: 0,
                      marginBottom: 0,
                      overflow: 'visible',
                    }}
                  >
                    {filteredCategories.map((category) => (
                      <CategoryItem
                        key={category.id}
                        category={category}
                        onPress={handleCategoryPress}
                      />
                    ))}
                  </ScrollView>
                )}
              </Animated.View>
            </View>
          </CoachMarkTarget>

          {/* Quick Actions */}
          <CoachMarkTarget name="quick-actions">
            <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, marginBottom: HOME_SECTION_VERTICAL_GAP }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: HOME_QUICK_ACTIONS_PANEL_BORDER,
                  borderRadius: BorderRadius.default,
                  backgroundColor: HOME_QUICK_ACTIONS_PANEL_BG,
                  paddingHorizontal: 16,
                  paddingTop: 20,
                  paddingBottom: 20,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text
                      className="text-lg font-bold"
                      style={{
                        fontFamily: 'Poppins-Bold',
                        letterSpacing: -0.2,
                        color: '#FFFFFF',
                      }}
                    >
                      Quick actions
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Poppins-Regular',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginTop: 5,
                        lineHeight: 18,
                      }}
                    >
                      Start common tasks in one tap.
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(quickActions || []).map((action: QuickAction) => (
                    <TouchableOpacity
                      key={action.id}
                      onPress={() => {
                        haptics.light();
                        if (action.id === 'emergency') {
                          router.push({
                            pathname: '/(tabs)/categories',
                            params: { emergency: 'true' },
                          });
                        } else if (action.id === 'book-again') {
                          router.push('/(tabs)/jobs' as any);
                        } else if (action.id === 'wallet') {
                          router.push('/WalletScreen' as any);
                        }
                      }}
                      activeOpacity={0.88}
                      style={{
                        flex: 1,
                        backgroundColor: HOME_QUICK_ACTION_TILE_BG,
                        borderRadius: BorderRadius.default,
                        paddingVertical: 13,
                        paddingHorizontal: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: HOME_QUICK_ACTION_TILE_BORDER,
                        shadowColor: 'transparent',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0,
                        shadowRadius: 0,
                        elevation: 0,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: action.backgroundColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.45)',
                        }}
                      >
                        <Ionicons
                          name={action.iconName as any}
                          size={20}
                          color={action.color}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-SemiBold',
                          color: HOME_QUICK_ACTION_LABEL,
                          textAlign: 'center',
                          lineHeight: 16,
                        }}
                        numberOfLines={2}
                      >
                        {action.id === 'emergency' ? 'Urgent help' : action.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </CoachMarkTarget>

          {/* Referral promo card hidden for now while the home design is being simplified.
          <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
            <View
              style={{
                backgroundColor: Colors.accent,
                borderRadius: 16,
                paddingVertical: 24,
                paddingHorizontal: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: surfaceElevation(1),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: 'Poppins-Bold',
                      color: '#000000',
                      marginBottom: 6,
                    }}
                  >
                    Invite Friends, Earn Rewards
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Medium',
                      color: 'rgba(0, 0, 0, 0.7)',
                      marginBottom: 12,
                      lineHeight: 18,
                    }}
                  >
                    Get $10 credit for each friend who signs up
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#000000',
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 18,
                      alignSelf: 'flex-start',
                    }}
                    onPress={async () => {
                      haptics.light();
                      await shareReferral({ role: 'client', code: undefined });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Poppins-SemiBold',
                        color: '#FFFFFF',
                        textAlign: 'center',
                      }}
                    >
                      Invite Now
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    borderRadius: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 14,
                  }}
                >
                  <Ionicons name="gift" size={32} color="#000000" />
                </View>
              </View>
            </View>
          </View>
          */}
          <View className='px-4 mb-6 hidden'>
            <Text className='text-lg font-bold mb-2' style={{ fontFamily: 'Poppins-Bold', letterSpacing: -0.3 }}>Todo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className='flex mt-0  flex-row '>
              {todoItems.map((item) => (
                <TodoCard key={item.id} {...item} />
              ))}
            </ScrollView>
          </View>
          <CoachMarkTarget name="job-activity" style={{ overflow: 'visible' }}>
            <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, marginBottom: HOME_SECTION_VERTICAL_GAP, overflow: 'visible' }}>
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text
                    className="text-lg font-bold text-black"
                    style={{ letterSpacing: -0.3, fontFamily: 'Poppins-Bold', flexShrink: 1 }}
                  >
                    Job activity
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center"
                    onPress={handleViewAllJobs}
                    activeOpacity={0.7}
                    style={{
                      flexShrink: 0,
                      marginLeft: 12,
                      backgroundColor: Colors.white,
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: 999,
                      ...SURFACE_STYLES.chipOutline,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{ fontFamily: 'Poppins-SemiBold', color: HOME_QUICK_ACTIONS_PANEL_BG }}
                    >
                      View all
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={HOME_QUICK_ACTIONS_PANEL_BG} />
                  </TouchableOpacity>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    lineHeight: 18,
                  }}
                >
                  Track your latest requests, in progress, completed, or declined.
                </Text>
              </View>
              {(showJobsSkeleton || isJobsLoadingEmpty) ? (
                <>
                  <JobCardSkeleton />
                  <JobCardSkeleton />
                </>
              ) : jobActivities.length > 0 ? (
                jobActivities.map((activity, index) => (
                  <View key={activity.id} style={{ marginBottom: index < jobActivities.length - 1 ? 12 : 0 }}>
                    <JobActivityCard activity={activity} />
                  </View>
                ))
              ) : (
                <View
                  style={{
                    ...providerListCard,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 32,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: '#F2F7EC',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Ionicons name="briefcase-outline" size={32} color={HOME_QUICK_ACTIONS_PANEL_BG} />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      marginBottom: 8,
                      textAlign: 'center',
                    }}
                  >
                    No jobs yet
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                      lineHeight: 20,
                    }}
                  >
                    Your recent job activity will appear here
                  </Text>
                </View>
              )}
            </View>
          </CoachMarkTarget>

          {/* Recommended for you section temporarily removed until we have real recommendations */}

          {/* Promo codes hidden for now while the client home design is being simplified.
          <View className="px-4 mb-10">
            <View className="flex-row items-center justify-between mb-5">
              <Text
                className="text-lg font-bold text-black"
                style={{ letterSpacing: -0.3, fontFamily: 'Poppins-Bold' }}
              >
                Promo Codes
              </Text>
              <View className="w-10 h-10 rounded-full bg-[#EEF1FF] items-center justify-center">
                <Ionicons name="pricetag-outline" size={18} color="#2563EB" />
              </View>
            </View>
            {promoCodes.map((promo, index) => (
              <View key={promo.id} style={{ marginBottom: index < promoCodes.length - 1 ? 16 : 0 }}>
                <PromoCodeCard promo={promo} />
              </View>
            ))}
          </View>
          */}

          <View style={{ height: bottomSpacerHeight }} />
        </Animated.View>
      </ScrollView>

      <AiSparkleFab />

      {/* Coach Marks - disabled */}

      {/* Location Search Modal */}
      <LocationSearchModal
        visible={showLocationModal}
        onClose={() => {
          setShowLocationModal(false);
          refreshLocation();
        }}
        onLocationSelected={(selectedLocation) => {
          setShowLocationModal(false);
          refreshLocation();
        }}
      />
      </View>
    </SafeAreaWrapper>
  );
});

HomeScreen.displayName = 'HomeScreen';

export default HomeScreen;