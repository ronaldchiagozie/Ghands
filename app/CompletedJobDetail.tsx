import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { JobProgressTimeline, type JobProgressStep } from '@/components/JobProgressTimeline';
import Demcatorline from "@/components/Demacator";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState } from '@/components/ErrorState';
import { haptics } from '@/hooks/useHaptics';
import { authService, serviceRequestService, ServiceRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, TextInput, View } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { analytics } from '@/services/analytics';
import { CheckCircle2, FileText, Wrench } from 'lucide-react-native';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { AvatarCircle } from '@/components/AvatarCircle';
import { pickProviderImageUriFromRecord } from '@/utils/clientProfilePhoto';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
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
    return timeString ? `${formattedDate}, ${timeString}` : formattedDate;
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
  // Start loading when a requestId is present so the first paint is the skeleton, not the
  // "unable to load" error state that only becomes true after the fetch actually fails.
  const [isLoading, setIsLoading] = useState(Boolean(params.requestId));
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [postReviewThankYou, setPostReviewThankYou] = useState(false);
  /** Your numeric rating (1–5) for this job — storage + API */
  const [myReviewRating, setMyReviewRating] = useState<number | null>(null);
  const completedContactToastShown = useRef(false);

  const providerAvatarUri = useMemo(
    () => pickProviderImageUriFromRecord(selectedProvider) ?? null,
    [selectedProvider],
  );

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
      showSuccess('Thanks for your review');
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

  const timelineSteps = useMemo((): JobProgressStep[] => {
    if (!request) return [];

    const createdAt = request.createdAt || new Date().toISOString();
    const updatedAt = request.updatedAt || createdAt;

    return [
      {
        id: 'step-1',
        title: 'Request received',
        description: 'Your job request was submitted.',
        status: formatTimeAgo(createdAt),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: CheckCircle2,
      },
      {
        id: 'step-2',
        title: 'Inspection & quotation',
        description: 'Provider inspected and submitted a quote.',
        status: formatTimeAgo(updatedAt),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: FileText,
      },
      {
        id: 'step-3',
        title: 'Job in progress',
        description: 'Provider completed the work.',
        status: formatTimeAgo(updatedAt),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: Wrench,
      },
      {
        id: 'step-4',
        title: 'Complete',
        description: 'Job completed.',
        status: formatTimeAgo(updatedAt),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: CheckCircle2,
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
        icon: <Ionicons name="calendar" color={Colors.tabInactive} size={18}/>
      },
      {
        name: "Location",
        subtitle: request.location?.formattedAddress || request.location?.address || 'Location not specified',
        icon: <Ionicons name="location" color={Colors.tabInactive} size={18}/>
      },
      {
        name: 'Total Cost',
        subtitle: request.totalCost
          ? `₦${Number(request.totalCost).toLocaleString('en-NG', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : '₦0.00',
        icon: <Ionicons name="cash" color={Colors.tabInactive} size={18}/>
      }
    ];
  }, [request]);

  useEffect(() => {
    if (!request || request.status !== 'completed') return;
    if (completedContactToastShown.current) return;
    completedContactToastShown.current = true;
    showInfo(
      'Messaging and calls are not available after a job is completed. For issues, use Help & Support to reach our team.'
    );
  }, [request?.id, request?.status, showInfo]);

  if (isLoading) {
    return (
      <SafeAreaWrapper>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text className="mt-4" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
            Loading job details...
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!request) {
    return (
      <SafeAreaWrapper>
        <View className="flex-1 items-center justify-center px-8">
          <ErrorState
            message="Unable to load job details. Please try again."
            onRetry={loadRequestDetails}
            retryLabel="Retry"
          />
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
                className="flex flex-row items-center justify-between px-5 py-5 bg-white rounded-2xl border" style={{ borderColor: Colors.borderLight }}
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
                  <AvatarCircle uri={providerAvatarUri} size={56} />
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
                        className="text-sm"
                        style={{
                          fontFamily: 'Poppins-Regular',
                          color: Colors.textMuted,
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
                          className="text-xs"
                          style={{ fontFamily: 'Poppins-Medium', color: Colors.iconMuted }}
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
                          className="text-xs"
                          style={{ fontFamily: 'Poppins-SemiBold', color: Colors.success }}
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
                  backgroundColor: Colors.surfaceSubtle,
                  borderRadius: BorderRadius.default,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  className="text-xs"
                  style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted, lineHeight: 18 }}
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
                className="text-sm leading-6"
                style={{
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textMuted,
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
                      className="text-sm mb-1"
                      style={{
                        fontFamily: 'Poppins-Medium',
                        color: Colors.iconMuted,
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
                className="flex gap-3 flex-row mt-4 py-4 rounded-xl items-center justify-center" style={{ backgroundColor: Colors.accent }}
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
              <JobProgressTimeline steps={timelineSteps} />
            </View>

            {hasSubmittedReview && !showRatingModal && (
              <View
                style={{
                  backgroundColor: Colors.successLight,
                  borderRadius: BorderRadius.default,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: Colors.borderSage,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.success,
                  }}
                >
                  You’ve rated this job. Thank you!
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
                backgroundColor: Colors.overlayScrim,
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
                            color={filled ? Colors.star : Colors.borderStrong}
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