import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { isSubmittedBooking } from '@ghands/contract';
import AnimatedStatusChip from '@/components/AnimatedStatusChip';
import { haptics } from '@/hooks/useHaptics';
import { useOnNetworkRestore } from '@/hooks/useNetworkConnectivity';
import { authService, serviceRequestService, ServiceRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { AuthError } from '@/utils/errors';
import { isConnectivityOrNetworkError } from '@/utils/isNetworkFailure';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { Star } from 'lucide-react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { JobHistoryCardSkeleton } from '@/components/LoadingSkeleton';
import { JobsTabEmptyState } from '@/components/JobsTabEmptyState';
import {
  JobMetaIconCalendar,
  JobMetaIconLocation,
  JobMetaIconPerson,
  JobMetaIconQuotes,
} from '@/components/jobs/JobStatusIcons';
import { useSkeletonGate } from '@/hooks/useSkeletonGate';
import { Colors, REFRESH_CONTROL, useTabScrollContentPaddingTop, useTabScreenScrollBottomPadding } from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractMyRatingFromRequest, reviewRatingStorageKey } from '@/utils/reviewSync';
import { navigateToJob } from '@/utils/navigation';
import { summarizeJobDescription } from '@/utils/jobDescriptionSummary';
import { jobHasSentQuotation, countSentQuotations } from '@/utils/quotationStatus';
import {
  canCancelJobFromCard,
  getJobDisplayStatusBadge,
  isCompletedJobDisplayStatus,
  isJobsListHiddenStatus,
  isOngoingJobDisplayStatus,
  isPendingTabJobDisplayStatus,
  resolveJobDisplayStatus,
  showQuoteCountOnJobCard,
  type JobDisplayStatus,
} from '@/utils/jobDisplayStatus';
import { mergeCachedVisitRequest } from '@/utils/visitRequestCache';
import { healJobStatusAfterVisitDecline } from '@/utils/visitStatus';
import { formatDateShort } from '@/utils/dateFormatting';
import {
  resumeRouteFor,
  pointFromDraft,
  resumeStepLabel as stepLabelForPoint,
  resumeProgress as progressForPoint,
  resumeHoursLeft as hoursLeftForPoint,
  type BookingResumePoint,
} from '@/utils/bookingResume';
import { useBookingResume } from '@/hooks/useBookingResume';
import ResumeBookingCard from '@/components/home/ResumeBookingCard';
import Toast from '@/components/Toast';

/**
 * 'Drafts' is not a job status the server knows about. It is a tab that exists
 * only while this device is holding an unfinished booking, so the row does not
 * carry a permanently empty section for something most people never have.
 */
type JobStatus = 'Pending' | 'Ongoing' | 'Completed';
type JobTab = JobStatus | 'Drafts';

type JobItem = {
  id: number;
  title: string;
  subtitle: string;
  status: JobDisplayStatus;
  name: string;
  time: string;
  location: string;
  requestId?: number;
  acceptedProvidersCount?: number;
  quotationsCount?: number;
  /** Client’s rating (1-5) for this job when completed */
  myRating?: number;
};

type JobListItemProps = {
  job: JobItem;
  activeTab: JobStatus;
  onPrimaryAction: (status: JobStatus, job: JobItem) => void;
  onCancelRequest: (job: JobItem) => void;
};

const JobListItem = React.memo(function JobListItem({
  job,
  activeTab,
  onPrimaryAction,
  onCancelRequest,
}: JobListItemProps) {
  const statusBadge = getJobDisplayStatusBadge(job.status);

  return (
    <View
      style={{
        ...providerListCard,
        marginBottom: 12,
      }}
    >
      <View className="flex-row justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-lg text-black mb-1" style={{ fontFamily: 'Poppins-Bold' }}>
            {job.title}
          </Text>
          <Text
            className="text-sm"
            style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {job.subtitle}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <AnimatedStatusChip
            status={job.status}
            statusColor={statusBadge.bg}
            textColor={statusBadge.text}
            size="small"
            animated={true}
          />
          {activeTab === 'Pending' && canCancelJobFromCard(job.status, job.acceptedProvidersCount ?? 0) && (
            <TouchableOpacity
              className="bg-red-50 py-1.5 px-3 rounded-lg"
              activeOpacity={0.85}
              onPress={() => {
                haptics.warning();
                onCancelRequest(job);
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.error,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showQuoteCountOnJobCard(job.status) && (job.quotationsCount ?? 0) >= 0 && (
        <View className="flex-row items-center gap-3 mt-2">
          <JobMetaIconQuotes size={16} color={Colors.textMuted} />
          <Text className="text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
            {job.quotationsCount === 0
              ? 'Awaiting quotes'
              : `${job.quotationsCount} quote${job.quotationsCount === 1 ? '' : 's'}`}
          </Text>
        </View>
      )}
      <View className="flex-row items-center gap-3 mt-2">
        <JobMetaIconPerson size={16} color={Colors.textMuted} />
        <Text className="text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
          {job.name}
        </Text>
      </View>
      <View className="flex-row items-center gap-3 mt-2">
        <JobMetaIconCalendar size={16} color={Colors.textMuted} />
        <Text className="text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
          {job.time}
        </Text>
      </View>
      <View className="flex-row items-center gap-3 mt-2">
        <JobMetaIconLocation size={16} color={Colors.textMuted} />
        <Text className="text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
          {job.location}
        </Text>
      </View>

      {activeTab === 'Completed' && job.myRating != null && job.myRating >= 1 && (
        <View className="flex-row items-center gap-2 mt-3">
          <Text className="text-xs" style={{ fontFamily: 'Poppins-Medium', color: Colors.iconMuted }}>
            Your rating
          </Text>
          <View className="flex-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={`r-${job.id}-${i}`}
                size={14}
                color={i < job.myRating! ? Colors.accent : Colors.border}
                fill={i < job.myRating! ? Colors.accent : 'transparent'}
              />
            ))}
          </View>
          <Text className="text-xs" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.success }}>
            {job.myRating}/5
          </Text>
        </View>
      )}

      <View className="flex flex-row pt-4 justify-center">
        <TouchableOpacity
          className="py-3 px-6 rounded-lg w-full"
          style={{
            backgroundColor:
              activeTab === 'Ongoing' || activeTab === 'Pending'
                ? Colors.backgroundGray
                : Colors.accent,
          }}
          activeOpacity={0.85}
          onPress={() => onPrimaryAction(activeTab as JobStatus, job)}
        >
          <Text
            className={`text-sm text-center ${
              activeTab === 'Ongoing' || activeTab === 'Pending' ? 'text-black' : 'text-white'
            }`}
            style={{ fontFamily: 'Poppins-Medium' }}
          >
            {activeTab === 'Ongoing'
              ? 'Check Updates'
              : activeTab === 'Pending'
                ? 'View request'
                : 'View Details'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Helper to format date
const formatDate = (dateString?: string, timeString?: string): string => {
  if (!dateString) return 'Not scheduled';
  try {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    return timeString ? `${formattedDate} • ${timeString}` : formattedDate;
  } catch {
    return dateString;
  }
};

// Map ServiceRequest to JobItem
const mapRequestToJobItem = (
  request: ServiceRequest,
  acceptedProvidersCount: number = 0,
  quotations: unknown[] = [],
): JobItem => {
  const providerName =
    (request as ServiceRequest & { provider?: { name?: string } }).provider?.name ||
    request.nearbyProviders?.[0]?.name ||
    'Provider TBD';
  const categoryDisplayName = request.categoryName
    ? request.categoryName.charAt(0).toUpperCase() + request.categoryName.slice(1).replace(/([A-Z])/g, ' $1')
    : 'Service';
  
    const apiStatus = ((request as any).status ?? '').toString().toLowerCase();
    const hasQuotationSent = jobHasSentQuotation(quotations, request as unknown as Record<string, unknown>);
    const quotationsCount =
      countSentQuotations(quotations) || (hasQuotationSent ? 1 : 0);
    const status = resolveJobDisplayStatus(apiStatus, {
      acceptedProvidersCount,
      visitRequest: (request as any).visitRequest,
      hasQuotationSent,
    });
  
  const apiMyRating = extractMyRatingFromRequest(request);

  return {
    id: request.id,
    requestId: request.id,
    title: request.jobTitle || `${categoryDisplayName} Service`,
    subtitle: summarizeJobDescription(request.description, {
      jobTitle: request.jobTitle,
      maxLength: 72,
      maxSentences: 1,
    }),
    status,
    name: providerName,
    time: formatDate(request.scheduledDate, request.scheduledTime),
    location: request.location?.formattedAddress || request.location?.address || 'Location not specified',
    acceptedProvidersCount,
    quotationsCount,
    myRating: apiMyRating ?? undefined,
  };
};

export default function JobsScreen() {
  const tabScrollTop = useTabScrollContentPaddingTop(20);
  const scrollBottomPad = useTabScreenScrollBottomPadding(16);
  const params = useLocalSearchParams<{ initialTab?: string; requestId?: string }>();
  const [activeTab, setActiveTab] = useState<JobTab>(() => {
    const tab = params.initialTab;
    if (tab === 'Completed') return 'Completed';
    if (tab === 'Pending' || tab === 'Cancelled') return 'Pending';
    return 'Ongoing';
  });
  const [allJobs, setAllJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const {
    point: resumePoint,
    draft: resumeDraft,
    stepLabel: resumeStepLabel,
    progress: resumeProgress,
    hoursLeft: resumeHoursLeft,
    otherDrafts,
    discard: discardResumePoint,
    refresh: refreshResume,
  } = useBookingResume();

  /** The day they picked, when they got that far. Shared with each of otherDrafts below. */
  const scheduleLabelFor = useCallback((date?: string, time?: string | null) => {
    if (!date) return null;
    const day = formatDateShort(date);
    if (!day) return null;
    const trimmedTime = time?.trim();
    return trimmedTime ? `${day} at ${trimmedTime}` : day;
  }, []);

  const resumeScheduleLabel = useMemo(
    () => scheduleLabelFor(resumeDraft?.scheduledDate, resumeDraft?.scheduledTime),
    [scheduleLabelFor, resumeDraft?.scheduledDate, resumeDraft?.scheduledTime],
  );

  /**
   * Drafts only appears while there is one. A tab that is empty for almost
   * everybody almost always is a tab that teaches people to ignore the row.
   */
  const hasAnyDraft = !!resumePoint || otherDrafts.length > 0;
  const visibleTabs = useMemo<JobTab[]>(
    () => (hasAnyDraft ? ['Drafts', 'Pending', 'Ongoing', 'Completed'] : ['Pending', 'Ongoing', 'Completed']),
    [hasAnyDraft],
  );

  /** Finishing or discarding every draft takes the tab away underneath them. */
  useEffect(() => {
    if (activeTab === 'Drafts' && !hasAnyDraft) setActiveTab('Pending');
  }, [activeTab, hasAnyDraft]);

  /** Shared by the primary draft's card and each of otherDrafts - same navigation, different point. */
  const goToResumePoint = useCallback(
    (target: BookingResumePoint) => {
      haptics.light();
      const route = resumeRouteFor(target);
      router.push({ pathname: route.pathname as any, params: route.params } as any);
    },
    [router],
  );

  const handleResumeDraft = useCallback(() => {
    if (!resumePoint) return;
    goToResumePoint(resumePoint);
  }, [resumePoint, goToResumePoint]);

  const { toast, showError, hideToast } = useToast();

  // Load user requests from API
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load all requests
      const requests = await serviceRequestService.getUserRequests();
      
      // Ensure requests is always an array
      const requestsArray = Array.isArray(requests) ? requests : [];
      
      /**
       * The request row is created when a category is tapped, so backing out of
       * the flow leaves one behind. Title + description alone was not enough to
       * tell those apart: a user who filled the details and then quit still had
       * a row, and it showed as "Pending" as though providers were being found.
       * isSubmittedBooking additionally requires evidence the flow completed.
       */
      const confirmedRequests = requestsArray.filter((request) =>
        isSubmittedBooking(request),
      );
      
      // Map to job items - Load accepted providers for each request to determine correct status
      const jobItems = await Promise.all(
        confirmedRequests.map(async (request) => {
          let acceptedProvidersCount = 0;
          let quotations: unknown[] = [];
          try {
            const [acceptedProviders, quotes] = await Promise.all([
              serviceRequestService.getAcceptedProviders(request.id).catch(() => []),
              serviceRequestService.getQuotations(request.id).catch(() => []),
            ]);
            acceptedProvidersCount = acceptedProviders?.length || 0;
            quotations = Array.isArray(quotes) ? quotes : [];
          } catch {
            // Non-fatal: job row still renders with zero counts
          }
          let requestForStatus = request;
          try {
            requestForStatus = healJobStatusAfterVisitDecline(
              await mergeCachedVisitRequest(request.id, request),
            );
          } catch {
            requestForStatus = request;
          }
          return mapRequestToJobItem(requestForStatus, acceptedProvidersCount, quotations);
        })
      );

      const userId = await authService.getUserId();
      let finalJobs = jobItems;
      if (userId != null) {
        finalJobs = await Promise.all(
          jobItems.map(async (job) => {
            if (job.status !== 'Completed' || job.requestId == null) return job;
            if (job.myRating != null && job.myRating >= 1) return job;
            try {
              const raw = await AsyncStorage.getItem(reviewRatingStorageKey(userId, job.requestId));
              if (raw) {
                const n = parseInt(raw, 10);
                if (!isNaN(n) && n >= 1 && n <= 5) return { ...job, myRating: n };
              }
            } catch {
              /* ignore */
            }
            return job;
          })
        );
      }
      setAllJobs(finalJobs.filter((job) => !isJobsListHiddenStatus(job.status)));
    } catch (error: any) {
      // If AuthError, redirect immediately
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      
      // Check if it's a network error first
      if (isConnectivityOrNetworkError(error)) {
        // Global offline overlay handles UI; keep cached jobs for reconnect.
        return;
      }
      
      const errorMessage = getSpecificErrorMessage(error, 'get_requests');
      showError(errorMessage);
      setAllJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  // Deep-link / post-cancel: switch tab when initialTab param is passed
  useEffect(() => {
    const tab = params.initialTab;
    if (tab === 'Completed') setActiveTab('Completed');
    else if (tab === 'Pending' || tab === 'Cancelled') setActiveTab('Pending');
    else if (tab === 'Ongoing') setActiveTab('Ongoing');
  }, [params.initialTab]);

  // Load data on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRequests();
      /** So the draft disappears the moment they finish or discard it. */
      void refreshResume();
    }, [loadRequests, refreshResume])
  );

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([loadRequests(), refreshResume()]);
    setRefreshing(false);
    haptics.success();
  }, [loadRequests]);

  useOnNetworkRestore(() => {
    void loadRequests();
  });

  const jobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (activeTab === 'Pending') return isPendingTabJobDisplayStatus(job.status);
      if (activeTab === 'Ongoing') return isOngoingJobDisplayStatus(job.status);
      return isCompletedJobDisplayStatus(job.status);
    });
  }, [activeTab, allJobs]);

  const { showSkeleton: showJobsSkeleton, isLoadingEmpty: isJobsLoadingEmpty } =
    useSkeletonGate(isLoading, jobs.length === 0);

  const handlePrimaryAction = (status: JobStatus, job?: JobItem) => {
    haptics.selection();
    if ((status === 'Ongoing' || status === 'Pending') && job) {
      navigateToJob(router, { requestId: job.id, tab: 'updates' });
    } else if (status === 'Completed' && job) {
      // Pass requestId to CompletedJobDetail
      router.push({
        pathname: '/CompletedJobDetail',
        params: {
          requestId: job.id.toString(),
        },
      } as any);
    } else {
      router.push('/JobDetailsScreen');
    }
  };

  const handleCancelRequest = useCallback(
    (job: JobItem) => {
      const requestId = job.requestId ?? job.id;
      router.push({
        pathname: '/CancelRequestScreen',
        params: { requestId: String(requestId) },
      } as any);
    },
    [router],
  );

  const renderJobItem = useCallback(
    ({ item }: { item: JobItem }) => (
      <JobListItem
        job={item}
        /** Drafts renders no job rows, so this is always a real status here. */
        activeTab={activeTab as JobStatus}
        onPrimaryAction={handlePrimaryAction}
        onCancelRequest={handleCancelRequest}
      />
    ),
    [activeTab, handleCancelRequest],
  );

  const jobKeyExtractor = useCallback(
    (item: JobItem) => `${activeTab}-${item.id}`,
    [activeTab]
  );

  return (
    <SafeAreaWrapper tabletShellTop>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: tabScrollTop }}>
        <Text className="text-2xl text-black mb-5 text-center" style={{ fontFamily: 'Poppins-Bold' }}>
          Jobs
        </Text>

        {/**
          * Scrollable and spaced, rather than four items squeezed into one row.
          * A fourth tab appeared and justify-around answered by shrinking every
          * gap, so the labels ran into each other. Scrolling costs nothing when
          * everything fits and saves the layout when it does not.
          */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 6,
            /**
             * Real vertical padding, not none. A horizontal ScrollView sizes
             * itself to its content, so a row with no room to breathe clipped
             * the labels against its own edge.
             */
            paddingVertical: 6,
            gap: 26,
            alignItems: 'center',
          }}
          /**
           * A fixed height rather than flexGrow: 0. Letting it size to content
           * inside a flex column is what let the row collapse tighter than the
           * labels it holds.
           */
          style={{ height: 50, flexGrow: 0, flexShrink: 0, marginBottom: 10 }}
        >
          {visibleTabs.map((status) => {
            const isActive = activeTab === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(status);
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={{ alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: isActive ? 'Poppins-SemiBold' : 'Poppins-Medium',
                      color: isActive ? Colors.accent : Colors.textMuted,
                    }}
                  >
                    {status}
                  </Text>
                </View>
                <View
                  style={{
                    height: 2.5,
                    borderRadius: 2,
                    marginTop: 8,
                    alignSelf: 'stretch',
                    backgroundColor: isActive ? Colors.accent : 'transparent',
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {showJobsSkeleton || isJobsLoadingEmpty ? (
          <FlatList
            data={[1, 2, 3]}
            keyExtractor={(item) => `${activeTab}-skel-${item}`}
            renderItem={() => <JobHistoryCardSkeleton />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: scrollBottomPad }}
          />
        ) : (
          <FlatList
            /** The drafts tab is its own list: one unfinished booking, no jobs. */
            data={activeTab === 'Drafts' ? [] : jobs}
            keyExtractor={jobKeyExtractor}
            renderItem={renderJobItem}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              jobs.length === 0
                ? { flexGrow: 1, justifyContent: 'center', paddingBottom: scrollBottomPad }
                : { paddingBottom: scrollBottomPad }
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={REFRESH_CONTROL.tintColor}
                colors={REFRESH_CONTROL.colors as unknown as string[]}
              />
            }
            /**
              * The unfinished booking sits at the top of Pending, which is where
              * somebody looks for a booking they think they made. It used to
              * live on the home screen, where it was a permanent reminder of
              * something half-done on the one screen that should feel calm.
              */
            ListHeaderComponent={
              activeTab === 'Drafts' && hasAnyDraft ? (
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  {resumePoint ? (
                    <ResumeBookingCard
                      categoryName={resumePoint.categoryName}
                      jobTitle={resumeDraft?.jobTitle}
                      scheduleLabel={resumeScheduleLabel}
                      stepLabel={resumeStepLabel ?? 'Finish your booking'}
                      progress={resumeProgress ?? { done: 0, total: 4 }}
                      hoursLeft={resumeHoursLeft}
                      onResume={handleResumeDraft}
                      onDiscard={() => void discardResumePoint()}
                    />
                  ) : null}

                  {/** Every other abandoned draft on the account - same card, scored the same way. */}
                  {otherDrafts.map((row) => {
                    const itemPoint = pointFromDraft(row as any);
                    return (
                      <ResumeBookingCard
                        key={itemPoint.requestId}
                        categoryName={itemPoint.categoryName}
                        jobTitle={row.jobTitle}
                        scheduleLabel={scheduleLabelFor(row.scheduledDate, row.scheduledTime)}
                        stepLabel={stepLabelForPoint(itemPoint)}
                        progress={progressForPoint(itemPoint)}
                        hoursLeft={hoursLeftForPoint(itemPoint)}
                        onResume={() => goToResumePoint(itemPoint)}
                        onDiscard={() => void discardResumePoint(String(row.id))}
                      />
                    );
                  })}
                </View>
              ) : null
            }
            ListEmptyComponent={
              activeTab === 'Drafts' ? null : (
                <JobsTabEmptyState audience="client" activeTab={activeTab as JobStatus} />
              )
            }
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}
      </View>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}
