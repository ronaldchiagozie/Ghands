import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { JobProgressTimeline, type JobProgressStep } from '@/components/JobProgressTimeline';
import { ScreenHeader } from "@/components/ScreenHeader";
import { CompletedJobDetailSkeleton, JobDetailsTimelineSkeleton } from '@/components/LoadingSkeleton';
import { useErrorSheet } from '@/hooks/useErrorSheet';
import { haptics } from '@/hooks/useHaptics';
import { authService, serviceRequestService, ServiceRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, TextInput, View } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { analytics } from '@/services/analytics';
import { AlertCircle, ArrowRight, Banknote, Calendar, CheckCircle2, FileText, MapPin, Star, Wrench } from 'lucide-react-native';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { AvatarCircle } from '@/components/AvatarCircle';
import { pickProviderImageUriFromRecord } from '@/utils/clientProfilePhoto';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { formatTimeAgo } from '@/utils/dateFormatting';
import { logRatingDebug, logRatingError } from '@/utils/ratingDebugLog';
import { API_BASE_URL } from '@/lib/apiConfig';
import {
  extractMyRatingFromRequest,
  isAlreadyReviewedApiError,
  requestDetailsIndicatesClientReviewed,
  reviewRatingStorageKey,
} from '@/utils/reviewSync';
import Toast from '@/components/Toast';

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
  const { toast, showError, showSuccess, showInfo, showWarning, hideToast } = useToast();
  
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  /** The thrown error itself - the sheet needs its status, not just a string. */
  const [loadError, setLoadError] = useState<unknown>(null);
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
  /** Your numeric rating (1-5) for this job - storage + API */
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
    setLoadError(null);
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
        logRatingDebug('No userId for review flag - using legacy key only', { requestId });
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
      
      /**
       * Who did the work, from whichever place this account's record keeps it.
       *
       * This asked `provider` and then the accepted-providers list, and on a
       * finished job the server often fills neither - it fills
       * `selectedProvider`, and the name on the accepted quotation is the one
       * the rest of the app shows. So the screen reporting a job somebody had
       * already been paid for could not say who they were, while the timeline
       * and the receipt for the same job both named them.
       *
       * The quotation is checked last because it costs a request; the two
       * fields already on the record are free.
       */
      const named = (candidate: unknown): boolean =>
        !!candidate &&
        typeof candidate === 'object' &&
        typeof (candidate as { name?: unknown }).name === 'string' &&
        (candidate as { name: string }).name.trim().length > 0;

      const fromRecord =
        [requestDetails.selectedProvider, requestDetails.provider].find(named) ?? null;

      if (fromRecord) {
        setSelectedProvider(fromRecord as any);
      } else {
        try {
          const acceptedProviders = await serviceRequestService.getAcceptedProviders(requestId);
          const fromAccepted = acceptedProviders?.map((row) => row.provider).find(named) ?? null;
          if (fromAccepted) {
            setSelectedProvider(fromAccepted as any);
          } else {
            const quotations = await serviceRequestService.getQuotations(requestId);
            const accepted = quotations?.find((q: any) => q?.status === 'accepted') as any;
            const fromQuote = [accepted?.provider, quotations?.[0] && (quotations[0] as any).provider].find(named);
            if (fromQuote) setSelectedProvider(fromQuote as any);
          }
        } catch {
          // Nothing names them; the card says the name is unavailable.
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
      /**
       * The shared base, not a second hardcoded host. This pointed at
       * bamibuildit-backend-v1 while every other call goes to
       * bamibuildit-backend-v1-euv6, so debug output named a deployment the app
       * was not actually talking to.
       */
      const apiBase = API_BASE_URL;
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

      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useErrorSheet({
    error: loadError,
    subject: 'this job',
    hasContent: !!request,
    onRetry: loadRequestDetails,
  });

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
        icon: <Calendar color={Colors.accent} size={18} />
      },
      {
        name: "Location",
        subtitle: request.location?.formattedAddress || request.location?.address || 'Location not specified',
        icon: <MapPin color={Colors.accent} size={18} />
      },
      {
        name: 'Total Cost',
        /**
         * The amount, from whichever key carries it, and never a zero.
         *
         * This read `totalCost` alone and printed ₦0.00 when it was absent -
         * on a job whose own receipt, one tap away, said ₦40.00. A price of
         * zero is a statement about what somebody paid, and it was wrong.
         */
        subtitle: (() => {
          const record = request as unknown as Record<string, unknown>;
          const raw = [
            record.totalCost,
            record.total_amount,
            record.paymentAmount,
            record.amount,
            record.amountDueOnArrival,
          ].find((value) => {
            const n = Number(value);
            return value != null && value !== '' && Number.isFinite(n) && n > 0;
          });

          return raw == null
            ? 'Not available'
            : `₦${Number(raw).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
        })(),
        icon: <Banknote color={Colors.accent} size={18} />
      }
    ];
  }, [request]);

  /**
   * No toast. It said the same thing as the notice permanently on this
   * screen, a few hundred pixels above it - so opening a finished job threw
   * a blue banner over the header to repeat a sentence already sitting in
   * the body, and the one it covered was the title. The card stays; the
   * banner goes.
   */

  if (isLoading) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.surfaceSubtle}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <CompletedJobDetailSkeleton />
        </ScrollView>
      </SafeAreaWrapper>
    );
  }

  if (!request) {
    // Failed: keep the screen's shape, dimmed and still. ErrorSheet carries the
    // explanation and the retry.
    return (
      <SafeAreaWrapper>
        <View
          className="flex-1 px-6 pt-8"
          style={{ opacity: 0.35 }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <JobDetailsTimelineSkeleton />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.surfaceSubtle}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingTop: 20 }}>
            <View className="mb-6">
              <ScreenHeader
                title="Job details"
                onBack={() => navigateBack(router, NAV_FALLBACK.clientJobs)}
                backgroundColor="transparent"
                backButtonBackgroundColor="transparent"
                /**
                  * No padding of its own: this header sits inside the page's
                  * gutter already, so its own left padding was being added on
                  * top and pushing the arrow in past every heading below it.
                  */
                style={{ paddingHorizontal: 0 }}
                rightElement={
                  request ? (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        router.push({
                          pathname: '/ReportIssueScreen' as any,
                          params: { requestId: String(request.id) },
                        });
                      }}
                      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Report an issue"
                      accessibilityHint="Opens a form to report a problem with this job"
                    >
                      <AlertCircle size={22} color={Colors.textPrimary} strokeWidth={2} />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
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
                className="flex flex-row items-center justify-between px-5 py-5 bg-white rounded-2xl border"
                style={{ borderColor: Colors.borderLight }}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedProvider) {
                    haptics.selection();
                    router.push({
                      pathname: '/ProviderDetailScreen',
                      params: {
                        providerName: selectedProvider.name ?? '',
                        providerId: selectedProvider.id?.toString() || '',
                      },
                    } as any);
                  }
                }}
              >
                <View className="flex flex-row items-center gap-5">
                  {/** Their initials when there is no photo, not a grey outline of nobody. */}
                  <AvatarCircle uri={providerAvatarUri} name={selectedProvider?.name} size={56} />
                  <View>
                    {/**
                      * Their name, or that it has not loaded. Never "Provider
                      * TBD": this is a finished job, so somebody did the work
                      * and was paid for it, and a placeholder here says the
                      * app does not know who - in the same confident type it
                      * uses for the price.
                      */}
                    <Text
                      className="text-base mb-1"
                      style={{
                        fontFamily: 'Poppins-Bold',
                        color: selectedProvider?.name ? undefined : Colors.textMuted,
                      }}
                    >
                      {selectedProvider?.name || 'Name unavailable'}
                    </Text>
                    {!(myReviewRating != null && myReviewRating >= 1) ? (
                    <View className="flex flex-row gap-2 items-center">
                      <View className="flex-row">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const r = Number((selectedProvider as any)?.rating ?? 0);
                          const filled = i < Math.round(r);
                          return (
                            <Star
                              key={i}
                              size={14}
                              color={filled ? Colors.star : Colors.border}
                              fill={filled ? Colors.star : 'transparent'}
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
                            <Star
                              key={`y-${i}`}
                              size={16}
                              color={i < myReviewRating ? Colors.accent : Colors.border}
                              fill={i < myReviewRating ? Colors.accent : 'transparent'}
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
            <View className="mt-6 mb-6">
              <Text
                className="text-xl mb-4"
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
            <View className="mt-2 mb-8">
              <View>
                {bookedDate.map((items, index) => (
                  <View
                    key={index}
                    className="flex flex-row gap-4 items-center"
                    style={{
                      paddingVertical: 14,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: Colors.borderLight,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: Colors.white,
                        borderWidth: 1.5,
                        borderColor: 'rgba(79, 103, 57, 0.45)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {items.icon}
                    </View>
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
              </View>
              <TouchableOpacity
                className="flex gap-3 flex-row mt-4 py-4 rounded-xl items-center justify-center" style={{ backgroundColor: Colors.accent }}
                activeOpacity={0.85}
                onPress={() => {
                  haptics.selection();
                  analytics.track('view_receipt', { job_id: 'completed_job' });
                  openClientReceipt(router, {
                    requestId: params.requestId ?? String(request?.id ?? ''),
                    serviceName: request?.jobTitle || request?.categoryName || 'Service',
                    providerName: selectedProvider?.name ?? '',
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
                <ArrowRight size={18} color="white" />
              </TouchableOpacity>
            </View>

            
            <View className="mb-8">
              <JobProgressTimeline steps={timelineSteps} />
            </View>

            {/**
              * A way in to the rating that does not depend on a popup firing.
              *
              * Rating was reachable one way only: a modal that opens itself
              * when this screen loads and finds the job completed and not yet
              * reviewed. Miss that moment and there was no second chance -
              * nothing anywhere on the screen could reopen it.
              *
              * A cash-on-arrival job misses it most. Cash adds a confirmation
              * step from each side before the job can be completed at all, so
              * the customer is far more likely to be on this screen while the
              * status is still catching up - and once the auto-open has
              * decided not to fire, the provider simply cannot be rated.
              */}
            {!hasSubmittedReview && !showRatingModal ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  haptics.selection();
                  setPostReviewThankYou(false);
                  setShowRatingModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Rate this provider"
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    Rate this provider
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 17,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    How did the job go? It takes a moment.
                  </Text>
                </View>
                <ArrowRight size={18} color={Colors.accent} />
              </TouchableOpacity>
            ) : null}

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
          /**
            * No status check here any more. It duplicated the one the
            * auto-open already makes, and duplicating it is what made the
            * manual button above useless: a customer could ask to rate and
            * get nothing, because a status that had not caught up vetoed a
            * modal they had explicitly opened. Deciding whether to interrupt
            * is the auto-open's job; this only decides whether to draw.
            *
            * If the server will not take the review, it says so, and that is
            * a better answer than a button that does nothing.
            */
          visible={showRatingModal && (!hasSubmittedReview || postReviewThankYou)}
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
                    <CheckCircle2 size={52} color={Colors.accent} />
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
                    Tap stars (1-5), add an optional note, then submit to finish this booking.
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
                          <Star
                            size={28}
                            color={filled ? Colors.star : Colors.borderStrong}
                            fill={filled ? Colors.star : 'transparent'}
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
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}