import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import AnimatedStatusChip from '@/components/AnimatedStatusChip';
import Demcatorline from "@/components/Demacator";
import { ScreenHeader } from "@/components/ScreenHeader";
import { haptics } from '@/hooks/useHaptics';
import { authService, serviceRequestService, ServiceRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, TextInput, View } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { analytics } from '@/services/analytics';
import { CheckCircle2, FileText, Wrench, CheckCircle } from 'lucide-react-native';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { JOB_TIMELINE, timelineChipText } from '@/lib/jobTimelineTheme';
import { surfaceElevation } from '@/lib/surfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { formatTimeAgo } from '@/utils/dateFormatting';
import { logRatingDebug, logRatingError } from '@/utils/ratingDebugLog';
import {
  extractMyRatingFromRequest,
  isAlreadyReviewedApiError,
  requestDetailsIndicatesClientReviewed,
  reviewRatingStorageKey,
} from '@/utils/reviewSync';

/** Per logged-in user + job, so switching accounts does not hide/show the wrong modal state. */
const reviewSubmittedStorageKey = (userId: number, requestId: number) =>
  `@ghands:review_submitted_u${userId}_r${requestId}`;

/** Legacy (request-only); migrated to account-scoped key when user id is known */
const reviewSubmittedLegacyKey = (requestId: number) => `@ghands:review_submitted_${requestId}`;

// Helper to format date
const formatDate = (dateString?: string, timeString?: string): string => {
  if (!dateString) return 'Not scheduled';
  try {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    return timeString ? `${formattedDate} - ${timeString}` : formattedDate;
  } catch {
    return dateString;
  }
};

export default function CompletedJobDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string }>();
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [postReviewThankYou, setPostReviewThankYou] = useState(false);
  /** Your numeric rating (1–5) for this job — storage + API */
  const [myReviewRating, setMyReviewRating] = useState<number | null>(null);
  const completedContactToastShown = useRef(false);

  const providerAvatarUri = useMemo(() => {
    if (!selectedProvider) return null;
    const p = selectedProvider as Record<string, unknown>;
    const candidates = [p.avatar, p.profileImage, p.photoUrl, p.image];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0 && /^https?:\/\//i.test(c)) {
        return c.trim();
      }
    }
    return null;
  }, [selectedProvider]);

  useEffect(() => {
    if (params.requestId) {
      completedContactToastShown.current = false;
      loadRequestDetails();
    }
  }, [params.requestId]);

  const loadRequestDetails = async () => {
    if (!params.requestId) return;
    
    setIsLoading(true);
    try {
      const requestId = parseInt(params.requestId, 10);
      const { request: requestDetails, usedListFallback } =
        await serviceRequestService.getRequestDetailsWithListFallback(requestId);
      setRequest(requestDetails);
      if (usedListFallback) {
        showWarning(
          'We could not load the full job summary right now. Showing what we have from your jobs list.'
        );
      }

      const userId = await authService.getUserId();
      let alreadySubmitted = false;
      if (userId != null) {
        const scopedKey = reviewSubmittedStorageKey(userId, requestId);
        alreadySubmitted = (await AsyncStorage.getItem(scopedKey)) === '1';
        if (!alreadySubmitted) {
          const legacyKey = reviewSubmittedLegacyKey(requestId);
          const legacy = (await AsyncStorage.getItem(legacyKey)) === '1';
          if (legacy) {
            alreadySubmitted = true;
            await AsyncStorage.setItem(scopedKey, '1');
            logRatingDebug('Migrated legacy review flag to account-scoped key', {
              requestId,
              userId,
            });
          }
        }
      } else {
        alreadySubmitted =
          (await AsyncStorage.getItem(reviewSubmittedLegacyKey(requestId))) === '1';
        logRatingDebug('No userId for review flag — using legacy key only', { requestId });
      }

      // Same account, other device: local flag is empty but server already has the review
      if (!alreadySubmitted && requestDetailsIndicatesClientReviewed(requestDetails)) {
        alreadySubmitted = true;
        if (userId != null) {
          await AsyncStorage.setItem(reviewSubmittedStorageKey(userId, requestId), '1');
        } else {
          await AsyncStorage.setItem(reviewSubmittedLegacyKey(requestId), '1');
        }
        logRatingDebug('Review already on server (GET request details)', { requestId });
      }

      let ratingFromStorage: number | null = null;
      if (userId != null) {
        const rs = await AsyncStorage.getItem(reviewRatingStorageKey(userId, requestId));
        if (rs) {
          const n = parseInt(rs, 10);
          if (!isNaN(n) && n >= 1 && n <= 5) ratingFromStorage = n;
        }
      }
      const ratingFromApi = extractMyRatingFromRequest(requestDetails);
      setMyReviewRating(ratingFromApi ?? ratingFromStorage);

      setHasSubmittedReview(alreadySubmitted);
      logRatingDebug('Rating modal gate', {
        requestId,
        userId: userId ?? null,
        status: requestDetails.status,
        alreadySubmitted,
        willShowModal: requestDetails.status === 'completed' && !alreadySubmitted,
      });

      if (requestDetails.status === 'completed' && !alreadySubmitted) {
        setPostReviewThankYou(false);
        setShowRatingModal(true);
      } else {
        setShowRatingModal(false);
        setPostReviewThankYou(false);
      }
      
      // If request has an accepted provider, load provider details
      if (requestDetails.provider) {
        setSelectedProvider(requestDetails.provider);
      } else {
        // Try to get provider from accepted providers if status is completed
        try {
          const acceptedProviders = await serviceRequestService.getAcceptedProviders(requestId);
          if (acceptedProviders && acceptedProviders.length > 0) {
            // Get the first provider (should be the selected one for completed jobs)
            setSelectedProvider(acceptedProviders[0].provider);
          }
        } catch {
          // If no providers found, that's okay
        }
      }
      
      // Trigger success haptic for completed job
      haptics.success();
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }

      const requestIdNum = parseInt(params.requestId ?? '', 10);
      const apiBase =
        (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
        'https://bamibuildit-backend-v1.onrender.com';
      let detailsSafe: string | Record<string, unknown> | null = null;
      try {
        const d = error?.details;
        detailsSafe =
          d && typeof d === 'object'
            ? (JSON.parse(JSON.stringify(d)) as Record<string, unknown>)
            : d != null
              ? String(d)
              : null;
      } catch {
        detailsSafe = String(error?.details ?? '');
      }
      const token = await authService.getAuthToken().catch(() => null);
      const tokenSnippet =
        token && typeof token === 'string' && token.length > 8 ? `${token.slice(0, 8)}…` : token ? '(short)' : null;

      // Always log (grep Metro / Xcode / adb logcat for [BackendDebug][CompletedJobDetail])
      console.log(
        '[BackendDebug][CompletedJobDetail]',
        JSON.stringify(
          {
            screen: 'CompletedJobDetail (client completed job)',
            primaryEndpoint: `${apiBase}/api/request-service/requests/${requestIdNum}`,
            listFallbackEndpoint: `${apiBase}/api/request-service/requests`,
            note: 'App tries list when single GET returns 5xx; this log means both failed or job missing from list.',
            requestId: requestIdNum,
            httpStatus: error?.status ?? null,
            message: error?.message ?? String(error),
            details: detailsSafe,
            isNetworkError: !!(error as any)?.isNetworkError,
            tokenPresent: !!token,
            tokenSnippet,
          },
          null,
          2
        )
      );

      const errorMessage = getSpecificErrorMessage(error, 'get_request_details');
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!params.requestId) return;
    if (!rating || rating < 1) {
      showError('Please select a star rating (1-5).');
      return;
    }
    if (hasSubmittedReview) return;

    const requestId = parseInt(params.requestId, 10);
    if (isNaN(requestId)) return;

    setIsSubmittingReview(true);
    try {
      const payload = {
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
      };

      const userId = await authService.getUserId();
      logRatingDebug('handleSubmitReview: submitting', {
        requestId,
        userId: userId ?? null,
        rating: payload.rating,
        hasComment: !!payload.comment,
      });

      await serviceRequestService.reviewProvider(requestId, payload);

      if (userId != null) {
        await AsyncStorage.setItem(reviewSubmittedStorageKey(userId, requestId), '1');
        await AsyncStorage.setItem(reviewRatingStorageKey(userId, requestId), String(payload.rating));
      } else {
        await AsyncStorage.setItem(reviewSubmittedLegacyKey(requestId), '1');
        logRatingDebug('Saved review flag with legacy key (no userId)', { requestId });
      }

      setMyReviewRating(payload.rating);
      setHasSubmittedReview(true);
      setPostReviewThankYou(true);
      showSuccess('Thank you for your review!');
      logRatingDebug('handleSubmitReview: success', { requestId, userId: userId ?? null });
      analytics.track('submit_provider_review', { job_id: requestId, rating });
    } catch (e: any) {
      if (isAlreadyReviewedApiError(e)) {
        const uid = await authService.getUserId();
        if (uid != null) {
          await AsyncStorage.setItem(reviewSubmittedStorageKey(uid, requestId), '1');
        } else {
          await AsyncStorage.setItem(reviewSubmittedLegacyKey(requestId), '1');
        }
        setHasSubmittedReview(true);
        setShowRatingModal(false);
        setPostReviewThankYou(false);
        logRatingDebug('handleSubmitReview: already reviewed on server (other device / sync)', {
          requestId,
        });
        showSuccess('You already submitted a review for this job.');
        return;
      }
      logRatingError('handleSubmitReview: error', {
        requestId,
        message: e?.message,
        status: e?.status,
        details: e?.details,
      });
      const msg = getSpecificErrorMessage(e, 'review_provider') ?? e?.message ?? 'Failed to submit review.';
      showError(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Generate timeline from request data
  const timelineSteps = useMemo(() => {
    if (!request) return [];
    
    return [
      {
        id: 'step-1',
        title: 'Job Request Submitted',
        description: 'Request was created',
        status: `Completed - ${formatTimeAgo(request.createdAt || new Date().toISOString())}`,
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        icon: CheckCircle2,
      },
      {
        id: 'step-2',
        title: 'Inspection & Quotation',
        description: 'Provider inspected and submitted quotation',
        status: `Completed - ${formatTimeAgo(request.updatedAt || new Date().toISOString())}`,
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        icon: FileText,
      },
      {
        id: 'step-3',
        title: 'Job in Progress',
        description: 'Provider completed the work',
        status: `Completed - ${formatTimeAgo(request.updatedAt || new Date().toISOString())}`,
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        icon: Wrench,
      },
      {
        id: 'step-4',
        title: 'Complete',
        description: 'Job completed successfully',
        status: `Completed - ${formatTimeAgo(request.updatedAt || new Date().toISOString())}`,
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        icon: CheckCircle,
      },
    ];
  }, [request]);

  // Generate booked date info from request data
  const bookedDate = useMemo(() => {
    if (!request) return [];
    
    return [
      {
        name: "Scheduled Date",
        subtitle: formatDate(request.scheduledDate, request.scheduledTime),
        icon: <Ionicons name="calendar" color={'#9CA3AF'} size={18}/>
      },
      {
        name: "Location",
        subtitle: request.location?.formattedAddress || request.location?.address || 'Location not specified',
        icon: <Ionicons name="location" color={'#9CA3AF'} size={18}/>
      },
      {
        name: 'Total Cost',
        subtitle: request.totalCost
          ? `₦${Number(request.totalCost).toLocaleString('en-NG', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : '₦0.00',
        icon: <Ionicons name="cash" color={'#9CA3AF'} size={18}/>
      }
    ];
  }, [request]);

  const timelineAnimations = useMemo(
    () => timelineSteps.map(() => new Animated.Value(0)),
    [timelineSteps]
  );

  useEffect(() => {
    if (timelineSteps.length === 0) return;
    
    const timelineSequence = timelineAnimations.map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
        delay: index * 120,
      })
    );
    Animated.stagger(100, timelineSequence).start(() => {
      haptics.light();
    });
  }, [timelineSteps, timelineAnimations]);

  useEffect(() => {
    if (!request || request.status !== 'completed') return;
    if (completedContactToastShown.current) return;
    completedContactToastShown.current = true;
    showInfo(
      'Messaging and calls are not available after a job is completed. For issues, use Help & Support to reach our team.'
    );
  }, [request?.id, request?.status, showInfo]);

  const renderTimeline = () => {
    if (timelineSteps.length === 0) return null;
    
    return (
      <View className="mb-8">
        {timelineSteps.map((step, index) => {
          const isLast = index === timelineSteps.length - 1;
          const animation = timelineAnimations[index];

        const IconComponent = step.icon || CheckCircle2;
        
        return (
          <View key={step.id} className="flex-row" style={{ marginBottom: isLast ? 0 : 18 }}>
            <View className="items-center" style={{ marginRight: 16, paddingTop: 4 }}>
              <Animated.View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: step.dotColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2.5,
                  borderColor: '#FFFFFF',
                  transform: [
                    {
                      scale: animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                  opacity: animation,
                  shadowColor: JOB_TIMELINE.dotShadow,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.18,
                  shadowRadius: 5,
                  elevation: surfaceElevation(3),
                }}
              >
                <IconComponent size={15} color={Colors.white} />
              </Animated.View>
              {!isLast && (
                <View
                  style={{
                    width: 3,
                    flex: 1,
                    backgroundColor: JOB_TIMELINE.sage,
                    marginTop: 6,
                    borderRadius: 2,
                    minHeight: 44,
                    opacity: 0.4,
                  }}
                />
              )}
            </View>
            <Animated.View
              style={{
                flex: 1,
                opacity: animation,
                transform: [
                  {
                    translateY: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
                paddingTop: 0,
              }}
            >
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: JOB_TIMELINE.rowBorder,
                  backgroundColor: JOB_TIMELINE.rowBg,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                }}
              >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Bold',
                  color: '#1A1F16',
                  marginBottom: 6,
                  lineHeight: 21,
                  letterSpacing: -0.35,
                }}
              >
                {step.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: 'rgba(71, 85, 75, 0.88)',
                  marginBottom: 8,
                  lineHeight: 19,
                }}
              >
                {step.description}
              </Text>
              <AnimatedStatusChip
                status={step.status}
                statusColor={step.accent}
                textColor={timelineChipText({ isCompleted: true, isActive: false })}
                size="small"
                animated={true}
                pill
              />
              </View>
            </Animated.View>
          </View>
        );
      })}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaWrapper>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text className="text-gray-600 mt-4" style={{ fontFamily: 'Poppins-Medium' }}>
            Loading job details...
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!request) {
    return (
      <SafeAreaWrapper>
        <View className="flex-1 items-center justify-center py-20 px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text className="text-gray-600 mt-4 text-center" style={{ fontFamily: 'Poppins-Medium' }}>
            Unable to load job details. Please try again.
          </Text>
          <TouchableOpacity
            onPress={loadRequestDetails}
            className="mt-6 px-6 py-3 bg-[#4F6739] rounded-xl"
            activeOpacity={0.85}
          >
            <Text className="text-white" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingTop: 20 }}>
            <View className="mb-6">
              <ScreenHeader title="Job details" onBack={() => router.back()} />
            </View>
            <View className="mb-6">
              <Text
                className="text-xl mb-4"
                style={{
                  fontFamily: 'Poppins-SemiBold',
                }}
              >
                Service Provider
              </Text>
              <TouchableOpacity
                className="flex flex-row items-center justify-between px-5 py-5 bg-white rounded-2xl border border-gray-100"
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedProvider) {
                    haptics.selection();
                    router.push({
                      pathname: '/ProviderDetailScreen',
                      params: {
                        providerName: selectedProvider.name || 'Provider',
                        providerId: selectedProvider.id?.toString() || '',
                      },
                    } as any);
                  }
                }}
              >
                <View className="flex flex-row items-center gap-5">
                  <View className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                    <Image
                      source={
                        providerAvatarUri
                          ? { uri: providerAvatarUri }
                          : require('../assets/images/plumbericon.png')
                      }
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                  <View>
                    <Text
                      className="text-base mb-1"
                      style={{
                        fontFamily: 'Poppins-Bold',
                      }}
                    >
                      {selectedProvider?.name || 'Provider TBD'}
                    </Text>
                    {!(myReviewRating != null && myReviewRating >= 1) ? (
                    <View className="flex flex-row gap-2 items-center">
                      <View className="flex-row">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const r = Number((selectedProvider as any)?.rating ?? 0);
                          const filled = i < Math.round(r);
                          return (
                            <Ionicons
                              key={i}
                              name={filled ? 'star' : 'star-outline'}
                              size={14}
                              color={filled ? Colors.star : Colors.border}
                            />
                          );
                        })}
                      </View>
                      <Text
                        className="text-sm text-gray-600"
                        style={{
                          fontFamily: 'Poppins-Regular',
                        }}
                      >
                        {(selectedProvider as any)?.rating != null || (selectedProvider as any)?.totalReviews != null
                          ? `${Number((selectedProvider as any)?.rating ?? 0).toFixed(1)} (${Number((selectedProvider as any)?.totalReviews ?? 0)} reviews)`
                          : 'No ratings yet'}
                      </Text>
                    </View>
                    ) : null}
                    {myReviewRating != null && myReviewRating >= 1 && (
                      <View className="flex-row items-center gap-2 mt-2">
                        <Text
                          className="text-xs text-gray-500"
                          style={{ fontFamily: 'Poppins-Medium' }}
                        >
                          Your rating
                        </Text>
                        <View className="flex-row">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons
                              key={`y-${i}`}
                              name={i < myReviewRating ? 'star' : 'star-outline'}
                              size={16}
                              color={i < myReviewRating ? Colors.accent : Colors.border}
                            />
                          ))}
                        </View>
                        <Text
                          className="text-xs text-[#166534]"
                          style={{ fontFamily: 'Poppins-SemiBold' }}
                        >
                          {myReviewRating}/5
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <View
                className="mt-3 px-1"
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: BorderRadius.default,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  className="text-xs text-gray-600"
                  style={{ fontFamily: 'Poppins-Regular', lineHeight: 18 }}
                >
                  Chat and voice calls are closed once a job is completed. If you need help with this job, go to{' '}
                  <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.success }}>Help & Support</Text> in the app
                  to reach our team.
                </Text>
                <TouchableOpacity
                  className="mt-2 self-start"
                  activeOpacity={0.85}
                  onPress={() => {
                    haptics.selection();
                    router.push('/HelpSupportScreen' as any);
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ fontFamily: 'Poppins-SemiBold', color: Colors.accent }}
                  >
                    Open Help & Support
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Demcatorline />
            <View className="mt-8 mb-8 px-1">
              <Text
                className="text-xl mb-5"
                style={{
                  fontFamily: 'Poppins-SemiBold',
                }}
              >
                Job Description
              </Text>
              <Text
                className="text-sm text-[#4B5563] leading-6"
                style={{
                  fontFamily: 'Poppins-Regular',
                }}
              >
                {request.description || request.jobTitle || 'No description provided'}
              </Text>
            </View>
            <Demcatorline />
            <View className="mt-6 mb-8">
              {bookedDate.map((items, index) => (
                <View key={index} className="flex mb-4 flex-row gap-4 items-start">
                  <View className="mt-1">{items.icon}</View>
                  <View className="flex-1">
                    <Text
                      className="text-sm text-gray-500 mb-1"
                      style={{
                        fontFamily: 'Poppins-Medium',
                      }}
                    >
                      {items.name}
                    </Text>
                    <Text
                      className="text-base text-black"
                      style={{
                        fontFamily: 'Poppins-SemiBold',
                      }}
                    >
                      {items.subtitle}
                    </Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                className="flex gap-3 flex-row mt-4 py-4 rounded-xl items-center justify-center bg-[#4F6739]"
                activeOpacity={0.85}
                onPress={() => {
                  haptics.selection();
                  analytics.track('view_receipt', { job_id: 'completed_job' });
                  openClientReceipt(router, {
                    requestId: params.requestId ?? String(request?.id ?? ''),
                    serviceName: request?.jobTitle || request?.categoryName || 'Service',
                    providerName: selectedProvider?.name || 'Provider',
                  });
                }}
              >
                <Text
                  className="text-white text-base"
                  style={{
                    fontFamily: 'Poppins-SemiBold',
                  }}
                >
                  View receipt
                </Text>
                <Ionicons size={18} name="arrow-forward" color="white" />
              </TouchableOpacity>
            </View>

            
            <View className="mb-8">
              {renderTimeline()}
            </View>

            {hasSubmittedReview && !showRatingModal && (
              <View
                style={{
                  backgroundColor: '#ECFDF5',
                  borderRadius: BorderRadius.default,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#BBF7D0',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.success,
                  }}
                >
                  You’ve rated this job — thank you!
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={
            request.status === 'completed' &&
            showRatingModal &&
            (!hasSubmittedReview || postReviewThankYou)
          }
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'center',
                paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
              }}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.xl,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  maxWidth: 400,
                  width: '100%',
                  alignSelf: 'center',
                  maxHeight: '82%',
                }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
              {postReviewThankYou ? (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 14 }}>
                    <Ionicons name="checkmark-circle" size={52} color={Colors.accent} />
                  </View>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      textAlign: 'center',
                      marginBottom: 8,
                    }}
                  >
                    Thanks for rating
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                      marginBottom: 22,
                      lineHeight: 20,
                    }}
                  >
                    Your feedback helps everyone. When you’re ready, head back to your jobs for the next booking.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setShowRatingModal(false);
                      setPostReviewThankYou(false);
                      router.replace('/(tabs)/jobs' as any);
                    }}
                    style={{
                      backgroundColor: Colors.accent,
                      borderRadius: BorderRadius.default,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins-SemiBold',
                        color: Colors.white,
                        fontSize: 15,
                      }}
                    >
                      Continue to jobs
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      textAlign: 'center',
                      marginBottom: 6,
                    }}
                  >
                    Rate your provider
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                      marginBottom: 18,
                      lineHeight: 18,
                    }}
                  >
                    Tap stars (1–5), add an optional note, then submit to finish this booking.
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const starValue = i + 1;
                      const filled = starValue <= rating;
                      return (
                        <TouchableOpacity
                          key={starValue}
                          onPress={() => {
                            haptics.selection();
                            setRating(starValue);
                          }}
                          activeOpacity={0.85}
                          style={{ padding: 8 }}
                        >
                          <Ionicons
                            name={filled ? 'star' : 'star-outline'}
                            size={28}
                            color={filled ? Colors.star : '#CBD5E1'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      marginBottom: 14,
                    }}
                  >
                    {rating > 0 ? `${rating} / 5` : 'Select a rating'}
                  </Text>

                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Write a comment (optional)"
                    placeholderTextColor={Colors.placeholder}
                    multiline
                    numberOfLines={3}
                    style={{
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: BorderRadius.default,
                      padding: 12,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textPrimary,
                      backgroundColor: Colors.backgroundGray,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                  />

                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={isSubmittingReview || rating < 1}
                    onPress={handleSubmitReview}
                    style={{
                      backgroundColor:
                        rating < 1 ? Colors.backgroundGray : Colors.accent,
                      borderRadius: BorderRadius.default,
                      paddingVertical: 14,
                      alignItems: 'center',
                      marginTop: 16,
                    }}
                  >
                    {isSubmittingReview ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text
                        style={{
                          fontFamily: 'Poppins-SemiBold',
                          color: rating < 1 ? Colors.textSecondaryDark : Colors.white,
                          fontSize: 15,
                        }}
                      >
                        Submit rating
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
    </SafeAreaWrapper>
  );
}