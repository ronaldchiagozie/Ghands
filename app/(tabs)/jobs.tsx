import SafeAreaWrapper from '@/components/SafeAreaWrapper';
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
import { FlatList, Platform, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { JobHistoryCardSkeleton } from '@/components/LoadingSkeleton';
import { JobsTabEmptyState } from '@/components/JobsTabEmptyState';
import {
  JobMetaIconCalendar,
  JobMetaIconLocation,
  JobMetaIconPerson,
  JobMetaIconQuotes,
  JobTabIcon,
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

type JobStatus = 'Pending' | 'Ongoing' | 'Completed';

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
  /** Client’s rating (1–5) for this job when completed */
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
          onPress={() => onPrimaryAction(activeTab, job)}
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
  const [activeTab, setActiveTab] = useState<JobStatus>(() => {
    const tab = params.initialTab;
    if (tab === 'Completed') return 'Completed';
    if (tab === 'Pending' || tab === 'Cancelled') return 'Pending';
    return 'Ongoing';
  });
  const [allJobs, setAllJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { showError } = useToast();

  // Load user requests from API
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load all requests
      const requests = await serviceRequestService.getUserRequests();
      
      // Ensure requests is always an array
      const requestsArray = Array.isArray(requests) ? requests : [];
      
      const confirmedRequests = requestsArray.filter((request) => {
        // Must have both jobTitle and description or we ignore it as noise
        const hasJobTitle = request.jobTitle && request.jobTitle.trim().length > 0;
        const hasDescription = request.description && request.description.trim().length > 0;
        if (!hasJobTitle || !hasDescription) {
          return false;
        }

        return true;
      });
      
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
    }, [loadRequests])
  );

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await loadRequests();
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
        activeTab={activeTab}
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

        <View className="flex flex-row justify-around mb-5">
          {(['Pending', 'Ongoing', 'Completed'] as JobStatus[]).map((status) => {
            const isActive = activeTab === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(status);
                }}
                activeOpacity={0.8}
                style={{ alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <JobTabIcon
                    tab={status}
                    size={18}
                    color={isActive ? Colors.accent : Colors.textMuted}
                  />
                  <Text
                    className="text-base"
                    style={{ fontFamily: 'Poppins-Medium', color: isActive ? Colors.textPrimary : Colors.iconMuted }}
                  >
                    {status}
                  </Text>
                </View>
                <View
                  className="mt-2 h-0.5 rounded-full"
                  style={{ width: 88, backgroundColor: isActive ? Colors.accent : 'transparent' }}
                />
              </TouchableOpacity>
            );
          })}
        </View>

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
            data={jobs}
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
            ListEmptyComponent={<JobsTabEmptyState audience="client" activeTab={activeTab} />}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}
      </View>
    </SafeAreaWrapper>
  );
}
