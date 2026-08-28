import { CategorySkeleton } from '@/components/LoadingSkeleton';
import { resolveClientProfileComplete } from '@/utils/profileCompletion';
import { CLIENT_TAB_BAR_BASE_HEIGHT } from '@/lib/tabletLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { serviceRequestService, ServiceCategory, authService } from '@/services/api';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { haptics } from '@/hooks/useHaptics';
import { useOnNetworkRestore } from '@/hooks/useNetworkConnectivity';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { isConnectivityOrNetworkError } from '@/utils/isNetworkFailure';
import { extractUserIdFromToken } from '@/utils/tokenUtils';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, Spacing, SHADOWS, useTabScrollContentPaddingTop, useTabScreenScrollBottomPadding } from '@/lib/designSystem';
import { navigateBack, navigateToClientHomeTab, NAV_FALLBACK } from '@/utils/navigation';

interface CategoryData extends ServiceCategory {
  IconComponent: React.ComponentType;
}

export default function CategoryPage() {
  const insets = useSafeAreaInsets();
  const routes = useRouter();
  const params = useLocalSearchParams<{
    selectedCategoryId?: string;
    searchQuery?: string;
    fromAddButton?: string;
    fromHome?: string;
    /** When set with requestId, Continue returns to ServiceMapScreen instead of creating a new request */
    returnToServiceMap?: string;
    requestId?: string;
    preserveData?: string;
    selectedDateTime?: string;
    selectedDate?: string;
    selectedTime?: string;
    photoCount?: string;
    location?: string;
    latitude?: string;
    longitude?: string;
    serviceType?: string;
  }>();
  const { toast, showError, hideToast } = useToast();
  const [isToggle, setIsToggle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [hasNavigatedFromHome, setHasNavigatedFromHome] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const tabScrollTop = useTabScrollContentPaddingTop(20);
  const categoriesScrollBottomPad = useTabScreenScrollBottomPadding(28);
  const searchInputRef = useRef<TextInput>(null);
  const categoryRefs = useRef<{ [key: string]: number }>({});
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories from API on mount
  useEffect(() => {
    loadCategories();
  }, []);

  useOnNetworkRestore(() => {
    void loadCategories();
  });

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const apiCategories = await serviceRequestService.getCategories();
      
      // Ensure apiCategories is an array
      if (!Array.isArray(apiCategories)) {
        console.error('Categories API returned non-array:', apiCategories);
        showError('Invalid categories data. Please try again.');
        setCategories([]);
        return;
      }
      
      const categoriesWithIcons: CategoryData[] = apiCategories.map((cat) => ({
        ...cat,
        IconComponent: getCategoryIcon(cat.name, cat.displayName, cat.description),
      }));
      setCategories(categoriesWithIcons);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      if (isConnectivityOrNetworkError(error)) {
        return;
      }
      const errorMessage = getSpecificErrorMessage(error, 'get_categories');
      showError(errorMessage);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced category search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is too short, show all categories
    if (searchQuery.trim().length < 2) {
      // Reload all categories if we had searched before
      if (categories.length === 0 && !isLoading) {
        loadCategories();
      }
      return;
    }

    // Set searching state
    setIsSearching(true);

    // Debounce search by 400ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await serviceRequestService.searchCategories(searchQuery.trim());
        const categoriesWithIcons: CategoryData[] = results.map((cat) => ({
          ...cat,
          IconComponent: getCategoryIcon(cat.name, cat.displayName, cat.description),
        }));
        setCategories(categoriesWithIcons);
        setIsSearching(false);
      } catch (error: any) {
        console.error('Error searching categories:', error);
        if (isConnectivityOrNetworkError(error)) {
          setIsSearching(false);
          return;
        }
        const errorMessage = getSpecificErrorMessage(error, 'search_categories');
        showError(errorMessage);
        setCategories([]);
        setIsSearching(false);
      }
    }, 400);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleToggle = (name: string) => {
    haptics.light();
    setIsToggle((prev) => (prev === name ? "" : name));
  };

  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsToggle('');
    // Reload all categories
    loadCategories();
  };

  const filteredCategories = useMemo(() => {
    // If we have search query, categories are already filtered by API
    // But we can do additional client-side filtering if needed
    return categories;
  }, [categories]);

  // Track if we're coming from navigation vs tab
  useFocusEffect(
    useCallback(() => {
      // When screen comes into focus, check if we have searchQuery param
      // If not, we're coming from tab navigation, so clear the flag
      if (!params.searchQuery && !params.selectedCategoryId && params.fromHome !== '1') {
        setHasNavigatedFromHome(false);
        setSearchQuery('');
      }
    }, [params.searchQuery, params.selectedCategoryId, params.fromHome])
  );

  useEffect(() => {
    if (params.searchQuery) {
      const searchQueryValue = params.searchQuery;
      setSearchQuery(searchQueryValue);
      setHasNavigatedFromHome(true);
      const scrollTimer = setTimeout(() => {
        searchInputRef.current?.focus();
        const query = searchQueryValue.toLowerCase().trim();
        const firstMatch = categories.find(
          (category) =>
            category.displayName.toLowerCase().includes(query) ||
            category.name.toLowerCase().includes(query) ||
            category.description.toLowerCase().includes(query)
        );
        if (firstMatch && scrollViewRef.current) {
          setIsToggle(firstMatch.name);
          const categoryIndex = categories.findIndex(
            (cat) => cat.name === firstMatch.name
          );
          if (categoryIndex !== -1) {
            const scrollPosition = categoryIndex * 110;
            scrollViewRef.current.scrollTo({
              y: scrollPosition,
              animated: true,
            });
          }
        }
      }, 400);

      return () => clearTimeout(scrollTimer);
    }
  }, [params.searchQuery, categories]);

  // Scroll to selected category when navigating from home
  useEffect(() => {
    if (params.selectedCategoryId && categories.length > 0 && !isLoading) {
      setHasNavigatedFromHome(true);
      
      // Normalize the selectedCategoryId for matching
      const normalizedSelectedId = params.selectedCategoryId.toLowerCase().trim();
      
      // Find category by name, displayName, or id (home screen might pass id)
      const category = categories.find(
        (cat) => {
          const catName = cat.name?.toLowerCase().trim() || '';
          const catDisplayName = cat.displayName?.toLowerCase().trim() || '';
          const catId = (cat as any).id?.toLowerCase().trim() || '';
          
          return catName === normalizedSelectedId || 
                 catDisplayName === normalizedSelectedId ||
                 catId === normalizedSelectedId ||
                 catName.includes(normalizedSelectedId) ||
                 catDisplayName.includes(normalizedSelectedId);
        }
      );
      
      if (category) {
        setIsToggle(category.name);
        
        // Wait for layout to complete, then scroll with proper positioning
        // Use multiple attempts to ensure layout is measured
        let attemptCount = 0;
        const maxAttempts = 8; // Increased attempts
        
        const scrollTimer = setInterval(() => {
          attemptCount++;
          
          // Use the actual layout position from categoryRefs if available
          const layoutPosition = categoryRefs.current[category.name];
          
          if (layoutPosition !== undefined && scrollViewRef.current) {
            // Get viewport height to ensure category is visible
            // Scroll with enough offset to keep category in view
            // Offset should account for header, search bar, and some padding
            const headerAndSearchHeight = 180; // Header + search bar + safe area + padding
            const cardHeight = 80; // Approximate card height
            const viewportPadding = 100; // Extra padding to ensure category is well within viewport
            
            // Calculate scroll position to ensure category is visible
            // Use generous padding to position category well within viewport
            const targetScrollPosition = Math.max(
              0, 
              layoutPosition - headerAndSearchHeight + viewportPadding
            );
            
            scrollViewRef.current.scrollTo({
              y: targetScrollPosition,
              animated: true,
            });
            
            // Double-check after animation completes
            setTimeout(() => {
              if (scrollViewRef.current) {
                const finalPosition = categoryRefs.current[category.name];
                if (finalPosition !== undefined) {
                  const currentScrollY = (scrollViewRef.current as any).contentOffset?.y || 0;
                  const viewportHeight = (scrollViewRef.current as any).layout?.height || 600;
                  
                  // Check if category is visible in viewport with generous margins
                  const categoryTop = finalPosition;
                  const categoryBottom = categoryTop + cardHeight;
                  const viewportTop = currentScrollY + headerAndSearchHeight;
                  const viewportBottom = currentScrollY + viewportHeight - 50; // Leave 50px margin at bottom
                  
                  // If category is not fully visible with margins, adjust scroll
                  if (categoryTop < viewportTop || categoryBottom > viewportBottom) {
                    // Use more generous padding to ensure visibility
                    const adjustedPosition = Math.max(
                      0,
                      categoryTop - headerAndSearchHeight + (viewportPadding + 30)
                    );
                    scrollViewRef.current.scrollTo({
                      y: adjustedPosition,
                      animated: true,
                    });
                  }
                }
              }
            }, 400); // Wait for first scroll animation to complete
            
            clearInterval(scrollTimer);
          } else if (attemptCount >= maxAttempts && scrollViewRef.current) {
            // Fallback: calculate position based on index after max attempts
            const categoryIndex = categories.findIndex(
              (cat) => cat.name === category.name
            );
            if (categoryIndex !== -1) {
              // More accurate calculation with proper offset
              const headerAndSearchHeight = 180;
              const cardHeight = 80;
              const cardMargin = 16;
              const viewportPadding = 100;
              const scrollPosition = Math.max(
                0,
                headerAndSearchHeight + (categoryIndex * (cardHeight + cardMargin)) - viewportPadding
              );
              
          scrollViewRef.current.scrollTo({
            y: scrollPosition,
            animated: true,
          });
        }
            clearInterval(scrollTimer);
          }
        }, 150); // Check every 150ms (faster checks)
        
        // Cleanup after 2.5 seconds max
        const cleanupTimer = setTimeout(() => {
          clearInterval(scrollTimer);
        }, 2500);
        
        return () => {
          clearInterval(scrollTimer);
          clearTimeout(cleanupTimer);
        };
      }
    }
  }, [params.selectedCategoryId, categories, isLoading]);

  const searchBarStyle = useMemo(() => ({ height: 50 }), []);
  
  const handleNextJobsScreen = async () => {
    if (isToggle !== "") {
      haptics.light();

      /**
       * Browsing needs nothing, but a booking does: a provider cannot act on a
       * job from someone with no name and no phone number. Ask here — at the
       * point the data is actually needed — rather than walling the app on open.
       */
      if (!(await resolveClientProfileComplete())) {
        showError('Add your name and phone so providers can reach you.');
        routes.push({
          pathname: '/ProfileCompletionScreen' as any,
          params: { returnTo: '/(tabs)/categories' },
        } as any);
        return;
      }

      if (params.returnToServiceMap === 'true' && params.requestId) {
        setIsCreatingRequest(true);
        try {
          routes.replace({
            pathname: '/ServiceMapScreen' as any,
            params: {
              requestId: String(params.requestId),
              categoryName: isToggle,
              serviceType: isToggle,
              selectedDateTime: params.selectedDateTime || '',
              selectedDate: params.selectedDate || '',
              selectedTime: params.selectedTime || '',
              photoCount: params.photoCount || '',
              location: params.location || '',
              ...(params.latitude ? { latitude: params.latitude } : {}),
              ...(params.longitude ? { longitude: params.longitude } : {}),
            },
          } as any);
        } finally {
          setIsCreatingRequest(false);
        }
        return;
      }

      setIsCreatingRequest(true);
      
      try {
        let userId = await authService.getUserId();
        
        // If user ID is not stored, try to get it from token
        if (!userId) {
          const token = await authService.getAuthToken();
          if (token) {
            const extractedUserId = extractUserIdFromToken(token);
            if (extractedUserId) {
              userId = extractedUserId;
              await authService.setUserId(userId);
              if (__DEV__) {
                if (__DEV__) console.log('User ID extracted from token');
              }
            } else {
              if (__DEV__) {
                console.warn('⚠️ Could not extract user ID from token. Token format might be different.');
              }
            }
          } else {
            if (__DEV__) {
              console.warn('⚠️ No auth token found');
            }
          }
        }
        
        if (!userId) {
          showError('Unable to identify your account. Please sign out and sign in again.');
          haptics.error();
          setIsCreatingRequest(false);
          return;
        }

        // Create service request (Step 1)
        // Only send categoryName - jobTitle and description will be added in JobDetailsScreen
        const response = await serviceRequestService.createRequest({
          userId,
          categoryName: isToggle,
          // Don't send jobTitle or description - they're optional and backend rejects empty strings
        });

        // Validate response has requestId
        if (!response || !response.requestId) {
          throw new Error('Invalid response: requestId not found');
        }

        // Navigate to JobDetailsScreen with requestId
        routes.push({
          pathname: '/JobDetailsScreen' as any,
          params: {
            requestId: response.requestId.toString(),
            categoryName: isToggle,
          },
        } as any);
      } catch (error: any) {
        console.error('Error creating service request:', error);
        const errorMessage = getSpecificErrorMessage(error, 'create_request');
        showError(errorMessage);
        haptics.error();
      } finally {
        setIsCreatingRequest(false);
      }
    } else {
      showError('Please choose a category');
      haptics.error();
    }
  };

  const isFromStackScreen = !!params.fromAddButton || params.fromHome === '1';
  const isFromServiceMapEdit = params.returnToServiceMap === 'true';
  const isFromNavigation =
    !!params.selectedCategoryId ||
    params.fromHome === '1' ||
    hasNavigatedFromHome ||
    isFromStackScreen ||
    isFromServiceMapEdit;

  return (
    <SafeAreaWrapper tabletShellTop>
      <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: tabScrollTop }}>
          {isFromNavigation ? (
            <View className=' flex flex-row px-3 items-center mb-6 gap-20'>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  if (isFromStackScreen || isFromServiceMapEdit) {
                    if (routes.canGoBack()) {
                      routes.back();
                    } else {
                      navigateBack(routes, NAV_FALLBACK.clientHome);
                    }
                  } else {
                    navigateToClientHomeTab(routes);
                  }
                }}
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.backgroundGray }}
              >
                <ArrowLeft size={20} color={Colors.surfaceDark} />
              </TouchableOpacity>
              <Text style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.3,
                textAlign: 'center',
              }}>Request Service</Text>
            </View>
          ) : (
            <View className='px-3 mb-6'>
              <Text style={{
                fontSize: 20,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.3,
              }}>Request Service</Text>
            </View>
          )}
          <View className='pb-6 px-0'>

            <View
              className="rounded-xl px-6 py-0 flex-row items-center"
              style={[searchBarStyle, { backgroundColor: Colors.backgroundGray }]}
            >
              <TextInput
                ref={searchInputRef}
                placeholder="Search for services"
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                className="flex-1 text-black text-base"
                placeholderTextColor={Colors.placeholder}
                style={{ fontFamily: 'Poppins-Medium' }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                  activeOpacity={0.7}
                  accessibilityLabel="Clear search"
                >
                  <X size={18} color={Colors.textSecondaryDark} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, backgroundColor: Colors.accent, borderRadius: BorderRadius.default, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                disabled={isSearching}
                accessibilityLabel="Search categories"
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                <Search size={18} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: categoriesScrollBottomPad }}
            scrollEnabled={true}
            onContentSizeChange={() => {
              // When content size changes, re-check if we need to scroll to selected category
              const selectedCategoryId = params.selectedCategoryId;
              if (selectedCategoryId && categories.length > 0) {
                const category = categories.find(
                  (cat) => 
                    cat.name === selectedCategoryId || 
                    cat.name?.toLowerCase() === selectedCategoryId.toLowerCase()
                );
                if (category && categoryRefs.current[category.name] !== undefined) {
                  setTimeout(() => {
                    const layoutY = categoryRefs.current[category.name];
                    if (layoutY !== undefined && scrollViewRef.current) {
                      const headerAndSearchHeight = 180;
                      const viewportPadding = 100;
                      scrollViewRef.current.scrollTo({
                        y: Math.max(0, layoutY - headerAndSearchHeight + viewportPadding),
                        animated: true,
                      });
                    }
                  }, 100);
                }
              }
            }}
          >
            <Text className='text-xl pb-2' style={{
              fontFamily: 'Poppins-Bold'
            }}>All Categories</Text>
            <View style={{
              flexDirection: 'column',
              alignItems: 'center',
              position: "relative"
            }}>
              {isLoading || isSearching ? (
                <>
                  <CategorySkeleton />
                  <CategorySkeleton />
                  <CategorySkeleton />
                  <CategorySkeleton />
                </>
              ) : filteredCategories.length === 0 ? (
                <View style={{ paddingVertical: Spacing.xxxl * 1.5, alignItems: 'center', paddingHorizontal: Spacing.lg }}>
                  <View style={{
                    width: 80,
                    height: 80,
                    borderRadius: BorderRadius.full,
                    backgroundColor: Colors.backgroundGray,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: Spacing.lg,
                    ...SHADOWS.sm,
                  }}>
                    <Search size={36} color={Colors.textTertiary} />
                  </View>
                  <Text style={{
                    fontSize: 18,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                    marginBottom: Spacing.sm,
                    textAlign: 'center',
                    letterSpacing: -0.3,
                  }}>
                    No results found
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    textAlign: 'center',
                    lineHeight: 20,
                    maxWidth: 280,
                    marginBottom: Spacing.xs,
                  }}>
                    {searchQuery.trim() 
                      ? `We couldn't find any categories matching "${searchQuery}"`
                      : 'No categories available. Please try again later.'}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textTertiary,
                    textAlign: 'center',
                  }}>
                    {searchQuery.trim() ? 'Try searching with different keywords' : 'Pull down to refresh'}
                  </Text>
                </View>
              ) : (
                filteredCategories.map((category, index) => (
                  <TouchableOpacity
                    onPress={() => handleToggle(category.name)}
                    key={category.name}
                    onLayout={(event) => {
                      // Store the absolute Y position of the category
                      const { y, height } = event.nativeEvent.layout;
                      categoryRefs.current[category.name] = y;
                      
                      // If this is the selected category and we're navigating from home, scroll to it
                      if (params.selectedCategoryId && 
                          (category.name === params.selectedCategoryId || 
                           category.name?.toLowerCase() === params.selectedCategoryId.toLowerCase())) {
                        // Use requestAnimationFrame to ensure layout is complete
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            if (scrollViewRef.current) {
                              // Calculate proper scroll position to ensure category is visible
                              // Use larger offset to ensure category stays in view
                              const headerAndSearchHeight = 180; // Header + search bar + safe area + padding
                              const viewportPadding = 100; // Extra padding to ensure category is well within viewport
                              
                              // Position category in upper-middle of viewport with generous padding
                              const targetScrollPosition = Math.max(
                                0,
                                y - headerAndSearchHeight + viewportPadding
                              );
                              
                              scrollViewRef.current.scrollTo({
                                y: targetScrollPosition,
                                animated: true,
                              });
                              
                              // Verify and re-adjust after scroll animation completes
                              setTimeout(() => {
                                if (scrollViewRef.current) {
                                  // Re-check position and adjust if category is not visible
                                  const currentY = categoryRefs.current[category.name];
                                  if (currentY !== undefined) {
                                    // Use even more generous padding on second attempt
                                    const adjustedPosition = Math.max(
                                      0,
                                      currentY - headerAndSearchHeight + (viewportPadding + 20)
                                    );
                                    scrollViewRef.current.scrollTo({
                                      y: adjustedPosition,
                                      animated: true,
                                    });
                                  }
                                }
                              }, 600); // After scroll animation completes
                            }
                          }, 200); // Delay for layout stability
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: isToggle === category.name ? Colors.sageTint : Colors.white,
                      borderRadius: BorderRadius.lg,
                      padding: 12,
                      marginBottom: 16,
                      borderWidth: isToggle === category.name ? 2 : 1,
                      borderColor: isToggle === category.name ? Colors.accent : Colors.border,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{
                      backgroundColor: 'transparent',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isToggle === category.name ? Colors.accent : Colors.border,
                      padding: 16,
                      marginRight: 16,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <category.IconComponent />
                    </View>
                    <View style={{
                      flex: 1,
                      justifyContent: 'center'
                    }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: Colors.textPrimary,
                        marginBottom: 6,
                        fontFamily: 'Poppins-SemiBold'
                      }}>
                        {category.displayName}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        width: '80%',
                        color: Colors.textSecondaryDark,
                        lineHeight: 16,
                        marginBottom: 4,
                        fontFamily: 'Poppins-Regular'
                      }}>
                        {category.description}
                      </Text>
                      <View style={{
                        backgroundColor: 'transparent',
                        borderRadius: 12,
                        alignSelf: 'flex-start'
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '500',
                          fontFamily: 'Poppins-Medium',
                          color: Colors.textSecondaryDark
                        }}>
                          {category.providerCount} {category.providerCount === 1 ? 'provider' : 'providers'}
                        </Text>
                      </View>
                      <TouchableOpacity className='absolute right-2' onPress={() => handleToggle(category.name)}
                      >
                        <View className={`h-6 w-6 border-0 rounded-full ${isToggle === category.name ? "bg-black" : "bg-transparent"
                          }`} >
                        </View>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
          <Button
            title={isCreatingRequest ? 'Creating…' : isFromServiceMapEdit ? 'Continue' : 'Add Details'}
            onPress={handleNextJobsScreen}
            variant="secondary"
            size="large"
            fullWidth
            disabled={!isToggle || isCreatingRequest}
            loading={isCreatingRequest}
            icon={<ArrowRight size={18} color={Colors.white} />}
            iconPosition="right"
            style={{
              marginTop: Spacing.lg,
              /**
               * This component renders twice: as the Categories tab (a tab bar
               * sits below it) and as the Request Service stack screen (nothing
               * below it). A fixed 96 cleared the tab bar but stranded the
               * button far up the stack screen.
               */
              marginBottom: isFromStackScreen
                ? Math.max(Spacing.lg, insets.bottom + Spacing.md)
                : CLIENT_TAB_BAR_BASE_HEIGHT + insets.bottom + Spacing.xl,
              width: '90%',
              alignSelf: 'center',
            }}
          />
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={hideToast}
        />
      </View>
    </SafeAreaWrapper>
  )
}
