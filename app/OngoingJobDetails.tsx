
import ConfirmModal from '@/components/ConfirmModal';
import { ClientJobUpdatesPanel } from '@/components/client/ClientJobUpdatesPanel';
import {
  DestructiveButton,
  InlineActionsRow,
  SageOutlineChip,
  SagePrimaryButton,
} from '@/components/client/JobTimelineActions';
import { type JobProgressStep } from '@/components/JobProgressTimeline';
import { JobDetailsContentSkeleton, JobDetailsQuotationsTabSkeleton } from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';
import { useCurrentUserProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { ScreenHeader } from '@/components/ScreenHeader';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { analytics } from '@/services/analytics';
import { QuotationWithProvider, ServiceRequest, serviceRequestService, walletService } from '@/services/api';
import { logDevAuthTokens } from '@/utils/devAuthTokens';
import { formatDateShort, formatTimeAgo } from '@/utils/dateFormatting';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { isConnectivityOrNetworkError } from '@/utils/isNetworkFailure';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { isDuplicateActionError } from '@/utils/idempotentSubmit';
import { mergeCachedVisitRequest, saveCachedVisitRequest } from '@/utils/visitRequestCache';
import {
  canClientDeclineVisit,
  getVisitDeclinedDescription,
  getVisitLogisticsStatus,
  hasMeaningfulVisitEngagement,
  healJobStatusAfterVisitDecline,
  isVisitDeclined,
  isVisitCompletedOrPaid,
  isVisitPaid,
  isProviderVisitRequestSent,
  patchVisitDeclined,
  resolveVisitOccurred,
} from '@/utils/visitStatus';
import { jobHasSentQuotation } from '@/utils/quotationStatus';
import {
  getInspectionNegotiationStep,
  getQuotationNegotiationStep,
} from '@/utils/timelineNegotiationSteps';
import { navigateBack, navigateBackFromBookingJob, NAV_FALLBACK } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Clock, FileText, MapPinned, Wrench } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Generate nice dummy quotations from accepted providers
const generateDummyQuotations = (acceptedProviders: any[], categoryName?: string): Quotation[] => {
  if (!acceptedProviders || acceptedProviders.length === 0) return [];

  const category = categoryName?.toLowerCase() || 'plumbing';

  // Service breakdowns based on category
  const serviceBreakdowns: Record<string, Array<{ service: string; price: string }>> = {
    plumbing: [
      { service: 'Complete faucet assessment', price: 'Free' },
      { service: 'High-quality cartridge & seals', price: '$40' },
      { service: 'Professional installation', price: '$25' },
    ],
    electrical: [
      { service: 'Electrical inspection', price: '$20' },
      { service: 'Wiring repairs', price: '$45' },
      { service: 'Safety testing', price: '$15' },
    ],
    carpentry: [
      { service: 'Material assessment', price: 'Free' },
      { service: 'Premium wood materials', price: '$55' },
      { service: 'Expert craftsmanship', price: '$35' },
    ],
    painting: [
      { service: 'Surface preparation', price: '$30' },
      { service: 'Premium paint materials', price: '$50' },
      { service: 'Professional painting', price: '$40' },
    ],
  };

  // Payment terms templates
  const paymentTermsTemplates = [
    [
      { text: '50% upfront, 50% on completion' },
      { text: 'All payment methods accepted' },
      { text: '90-day warranty on parts and labor' },
      { text: 'Money-back guarantee' },
    ],
    [
      { text: 'Full payment on completion' },
      { text: 'Cash, card, or mobile payment' },
      { text: '60-day warranty on all work' },
      { text: 'Satisfaction guaranteed' },
    ],
    [
      { text: '30% deposit, 70% on completion' },
      { text: 'Multiple payment options' },
      { text: '1-year warranty included' },
      { text: '24/7 support available' },
    ],
  ];

  const baseAmounts = [65, 75, 85, 95, 120, 150];

  return acceptedProviders.map((item, index) => {
    const breakdown = serviceBreakdowns[category] || serviceBreakdowns.plumbing;
    const paymentTerms = paymentTermsTemplates[index % paymentTermsTemplates.length];
    const baseAmount = baseAmounts[index % baseAmounts.length];
    const quoteAmount = `$${baseAmount}`;

    const totalFromBreakdown = breakdown.reduce((sum, item) => {
      const price = item.price === 'Free' ? 0 : parseFloat(item.price.replace('$', '')) || 0;
      return sum + price;
    }, 0);
    const finalAmount = totalFromBreakdown > 0 ? totalFromBreakdown : baseAmount;

    return {
      id: `quote-${item.provider.id}`,
      providerName: item.provider.name,
      providerType: 'Provider',
      providerImage: require('../assets/images/plumbericon2.png'),
      quoteAmount: `$${finalAmount}`,
      serviceBreakdown: breakdown.map(item => ({
        ...item,
        price: item.price === 'Free' ? 'Free' : item.price,
      })),
      paymentTerms,
      providerId: item.provider.id,
      distanceKm: item.distanceKm,
      minutesAway: item.minutesAway,
      acceptanceId: item.acceptance.id,
      acceptedAt: item.acceptance.acceptedAt,
    };
  });
};

const TAB_ITEMS: Array<'Updates' | 'Quotations'> = ['Updates', 'Quotations'];

const formatVisitFee = (value: number | undefined | null) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : null;

const formatVisitSchedule = (scheduledDate?: string | null, scheduledTime?: string | null) => {
  const dateText = formatDateShort(scheduledDate) || scheduledDate || '';
  const timeText = scheduledTime || '';
  if (dateText && timeText) return `${dateText} at ${timeText}`;
  return dateText || timeText || 'the scheduled time';
};

interface ServiceBreakdownItem {
  service: string;
  price: string;
}

interface PaymentTerm {
  text: string;
}

interface Quotation {
  id: string;
  providerName: string;
  providerType: string;
  providerImage: any; 
  quoteAmount: string;
  serviceBreakdown: ServiceBreakdownItem[];
  paymentTerms: PaymentTerm[];
}

interface ExtendedQuotation extends Quotation {
  providerId: number;
  distanceKm?: number;
  minutesAway?: number;
  acceptanceId?: number;
  acceptedAt?: string;
}

export default function OngoingJobDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    paymentStatus?: string;
    fromBooking?: string;
    tab?: string;
  }>();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const { data: currentUserProfile } = useCurrentUserProfile();
  const clientIdentity = useMemo(
    () => ({
      displayName: currentUserProfile?.name?.trim() || undefined,
      imageUri: currentUserProfile?.profileImageUri ?? null,
    }),
    [currentUserProfile?.name, currentUserProfile?.profileImageUri],
  );

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [acceptedProviders, setAcceptedProviders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<QuotationWithProvider[]>([]);
  const [paymentTransaction, setPaymentTransaction] = useState<any | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false);
  const [isQuotationActionLoading, setIsQuotationActionLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const completeJobLockRef = useRef(false);
  const declineVisitActionRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (params.requestId) {
      setIsLoading(true);
      setHasAttemptedLoad(false);
      setRequest(null);
      setAcceptedProviders([]);
      setQuotations([]);
      setPaymentTransaction(null);
    } else {
      setIsLoading(false);
    }
  }, [params.requestId]);
  const [activeTab, setActiveTab] = useState<'Updates' | 'Quotations'>(() =>
    params.tab === 'quotations' ? 'Quotations' : 'Updates'
  );
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const quoteCardAnim = useRef(new Animated.Value(1)).current;
  const [isSelectingProvider, setIsSelectingProvider] = useState(false);
  const [selectionCountdown, setSelectionCountdown] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [declineVisitModalVisible, setDeclineVisitModalVisible] = useState(false);
  const [isDecliningVisit, setIsDecliningVisit] = useState(false);

  const cameFromPaymentSuccess = params.paymentStatus === 'success';
  const cameFromBooking = params.fromBooking === '1';
  const insets = useSafeAreaInsets();
  const [contentAreaHeight, setContentAreaHeight] = useState(0);

  useEffect(() => {
    if (params.tab === 'quotations') {
      setActiveTab('Quotations');
    }
  }, [params.tab]);

  const openQuotationsTab = useCallback(() => {
    haptics.light();
    setActiveTab('Quotations');
  }, []);

  const handleJobDetailsBack = useCallback(() => {
    haptics.light();
    if (cameFromBooking) {
      navigateBackFromBookingJob(router);
      return;
    }
    navigateBack(router, NAV_FALLBACK.clientJobs);
  }, [cameFromBooking, params.requestId, router]);

  useFocusEffect(
    useCallback(() => {
      if (!cameFromBooking) return;
      const onHardwareBack = () => {
        navigateBackFromBookingJob(router);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [cameFromBooking, params.requestId, router])
  );

  const timelineSteps = useMemo(() => {
    if (!request) return [];

    const timeline = [];

    // Step 1: Job Request Submitted (always completed)
    // Show how many providers the request was sent to (from nearbyProviders if available)
    const totalProvidersSentTo = request.nearbyProviders?.length || acceptedProviders.length || 0;
    timeline.push({
      id: 'step-1',
      title: 'Request received',
      description: totalProvidersSentTo > 0
        ? `${totalProvidersSentTo} nearby ${totalProvidersSentTo === 1 ? 'provider' : 'providers'} notified.`
        : 'Review the job.',
      status: formatTimeAgo(request.createdAt || request.updatedAt),
      accent: JOB_TIMELINE.completeSoft,
      dotColor: JOB_TIMELINE.sage,
      isActive: false,
      isCompleted: true,
      icon: CheckCircle2,
    });

    // Step 1.5: Provider Selection (if applicable)
    if (request?.selectedProvider || request?.selectedAt) {
      if (request.status === 'accepted' && request.selectedProvider) {
        // Provider accepted selection
      timeline.push({
          id: 'step-1.5',
          title: 'Provider selected',
          description: `${request.selectedProvider.name} accepted.`,
          status: formatTimeAgo(request.updatedAt || request.selectedAt || ''),
          accent: JOB_TIMELINE.completeSoft,
          dotColor: JOB_TIMELINE.sage,
          isActive: false,
          isCompleted: true,
          icon: CheckCircle2,
        });
      } else if (request.selectedAt && selectionCountdown !== null && selectionCountdown > 0) {
        // Selection pending with countdown
        const mins = Math.floor(selectionCountdown / 60);
        const secs = selectionCountdown % 60;
        timeline.push({
          id: 'step-1.5',
          title: 'Provider selected',
          description: `Waiting for acceptance. ${mins}:${secs.toString().padStart(2, '0')} left.`,
          status: 'Waiting',
          accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
          isActive: true,
          isCompleted: false,
          icon: Clock,
        });
      } else if (request.selectedAt) {
        timeline.push({
          id: 'step-1.5',
          title: 'Provider selected',
          description: 'Waiting for acceptance.',
          status: 'Waiting',
          accent: JOB_TIMELINE.activeSoft,
          dotColor: JOB_TIMELINE.activeDot,
          isActive: true,
          isCompleted: false,
          icon: Clock,
        });
      }
    }

    // Step 2: Provider Acceptance (NEW STEP - shows when providers accept)
    // IMPORTANT: Use multiple indicators to determine if providers have accepted:
    // 1. acceptedProviders array has items
    // 2. Request status is beyond "pending" (in_progress, scheduled, completed) - means providers MUST have accepted
    // 3. Quotation exists (can't have quotation without provider accepting)
    const hasAcceptedProvidersFromAPI = acceptedProviders && acceptedProviders.length > 0;
    const hasAcceptedProvidersFromStatus = request.status === 'in_progress' || 
                                           (request.status as any) === 'scheduled' || 
                                           request.status === 'reviewing' ||
                                           request.status === 'completed' ||
                                           request.status === 'accepted' ||
                                           (request.status as any) === 'inspecting' || // Provider requested visit
                                           quotations.length > 0;
    const hasAcceptedProviders = hasAcceptedProvidersFromAPI || hasAcceptedProvidersFromStatus;
    
    // Show provider acceptance step if providers have accepted
    if (hasAcceptedProviders) {
      // Get the latest acceptance time
      const acceptanceTimes = acceptedProviders
        .filter(p => p.acceptance?.acceptedAt)
        .map(p => new Date(p.acceptance.acceptedAt).getTime());
      
      const latestAcceptance = acceptanceTimes.length > 0
        ? Math.max(...acceptanceTimes)
        : null;

      // Use actual count if available, otherwise infer from status
      const providerCount = hasAcceptedProvidersFromAPI ? acceptedProviders.length : 1;
      // Never use current time as fallback - use request dates or "Recently"
      const acceptanceTime = latestAcceptance != null
        ? String(latestAcceptance)
        : request.updatedAt || request.createdAt;
      
      timeline.push({
        id: 'step-2',
        title: 'Provider accepted',
        description: hasAcceptedProvidersFromAPI 
          ? `${providerCount} ${providerCount === 1 ? 'provider has' : 'providers have'} accepted.`
          : 'Provider accepted the job.',
        status: formatTimeAgo(acceptanceTime),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: CheckCircle2,
      });
      
    } else {
      // No providers accepted yet. Use Clock (not Circle) so icon has visible shape
      timeline.push({
        id: 'step-2',
        title: 'Provider response',
        description: 'Waiting for a provider.',
        status: 'Pending',
        accent: JOB_TIMELINE.pendingSoft,
        dotColor: JOB_TIMELINE.pendingDot,
        isActive: false,
        isCompleted: false,
        icon: Clock,
      });
      
    }

    // Step 3a: Inspection (visit) - separate from quotation
    const qList = Array.isArray(quotations) ? quotations : [];
    const hasQuotationSent = qList.some((q: any) => {
      if (!q || typeof q !== 'object') return false;
      if (q.sentAt || q.submittedAt) return true;
      if (q.status && q.status !== 'draft') return true;
      if (q.total != null && q.total > 0) return true;
      return false;
    }) || !!((request as any).providerId && (request as any).price != null);
    const visitRequest = (request as any).visitRequest;
    const visitStatus = getVisitLogisticsStatus(visitRequest);
    const visitDeclined = isVisitDeclined(visitRequest);
    const visitFeeText = formatVisitFee(visitRequest?.logisticsCost);
    const visitScheduleText = formatVisitSchedule(visitRequest?.scheduledDate, visitRequest?.scheduledTime);
    const hasVisitRequested = hasMeaningfulVisitEngagement(visitRequest);
    const visitOccurred = resolveVisitOccurred({
      visitRequest,
      requestStatus: request.status,
      quotations: qList,
    });
    const visitPaid = isVisitPaid(visitRequest);
    const visitBlocksQuote = visitOccurred && !visitPaid && !visitDeclined && !hasQuotationSent;
    const parseVisitFee = (value: unknown): number | undefined => {
      if (value == null || value === '') return undefined;
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(/[₦,\s]/g, ''));
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };
    const visitLogisticsCost =
      parseVisitFee(visitRequest?.logisticsCost) ??
      parseVisitFee((visitRequest as any)?.logistics_cost) ??
      parseVisitFee((request as any)?.logisticsCost);
    const hasPayableVisitFee = typeof visitLogisticsCost === 'number' && visitLogisticsCost > 0;

    const inspectionVisual = getInspectionNegotiationStep({
      audience: 'client',
      providerHasAccepted: hasAcceptedProviders,
      quotationSent: hasQuotationSent,
      hasVisitRequested,
      visitDeclined,
      visitPaid,
      visitScheduleText,
      visitRequest,
      visitOccurred,
    });
    const canDeclineVisit = canClientDeclineVisit({
      visitRequest,
      providerHasAccepted: hasAcceptedProviders,
      visitDeclined,
      hasQuotationSent,
    });
    timeline.push({
      id: 'step-3',
      title: 'Inspection',
      icon: MapPinned,
      ...inspectionVisual,
      description:
        !hasQuotationSent && visitOccurred && !visitDeclined && !visitPaid && visitFeeText
          ? `${inspectionVisual.description.replace(/\.$/, '')}. Fee: ${visitFeeText}.`
          : inspectionVisual.description,
      showPayLogistics: !visitDeclined && canDeclineVisit && hasPayableVisitFee,
      showRejectVisit: !visitDeclined && canDeclineVisit,
      logisticsCost: visitLogisticsCost,
    });

    // Step 3b: Quotation
    if (hasAcceptedProviders) {
      if (hasQuotationSent) {
        const quotation = qList.find((q: any) => q?.sentAt || (q as any)?.submittedAt || (q?.status && q?.status !== 'draft') || (q?.total != null && q?.total > 0));
        timeline.push({
          id: 'step-3b',
          title: 'Quotation',
          description: 'Quote received.',
          status: formatTimeAgo(quotation?.sentAt || (quotation as any)?.submittedAt || request.updatedAt || ''),
          accent: JOB_TIMELINE.completeSoft,
          dotColor: JOB_TIMELINE.sage,
          isActive: false,
          isCompleted: true,
          icon: FileText,
        });
      } else {
        const quotationVisual = getQuotationNegotiationStep({
          audience: 'client',
          providerHasAccepted: hasAcceptedProviders,
          quotationSent: hasQuotationSent,
          hasVisitRequested,
          visitDeclined,
          visitPaid,
          visitBlocksQuote,
          visitOccurred,
        });
        timeline.push({
          id: 'step-3b',
          title: 'Quotation',
          icon: FileText,
          ...quotationVisual,
        });
      }
    } else {
      const quotationVisual = getQuotationNegotiationStep({
        audience: 'client',
        providerHasAccepted: false,
        quotationSent: false,
        hasVisitRequested: false,
        visitDeclined: false,
        visitPaid: false,
        visitBlocksQuote: false,
      });
      timeline.push({
        id: 'step-3b',
        title: 'Quotation',
        icon: FileText,
        ...quotationVisual,
      });
    }

    // Step 4: Quotation Accepted
    // Client accepts the quotation (separate from payment)
    const quotationAccepted = qList.some((q: any) => q?.status === 'accepted');
    const acceptedQuotation = qList.find((q: any) => q?.status === 'accepted');
    
    if (quotationAccepted) {
      const paidAndConfirmed =
        ((request.status as any) || '').toString().toLowerCase() === 'scheduled' ||
        request.status === 'in_progress' ||
        request.status === 'reviewing' ||
        request.status === 'completed' ||
        !!paymentTransaction;
      timeline.push({
        id: 'step-4',
        title: 'Quote accepted',
        description: paidAndConfirmed ? 'Paid and confirmed.' : 'Complete payment to start.',
        status: paidAndConfirmed
          ? formatTimeAgo((acceptedQuotation as any)?.acceptedAt || acceptedQuotation?.sentAt || request.updatedAt || '')
          : 'Waiting',
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: !paidAndConfirmed,
        isCompleted: paidAndConfirmed,
        icon: paidAndConfirmed ? CheckCircle2 : Clock,
      });
    } else if (hasQuotationSent) {
      // Quotation sent but not accepted yet - YELLOW (waiting for client to accept)
      timeline.push({
        id: 'step-4',
        title: 'Quote accepted',
        description: 'Accept the quote.',
        status: 'Active',
        accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
        isActive: true,
        isCompleted: false,
        icon: Clock,
      });
    } else {
      // No quotation sent yet - grey (pending). Use FileText so icon isn't empty-looking
      timeline.push({
        id: 'step-4',
        title: 'Quote accepted',
        description: 'Waiting for quote.',
        status: 'Pending',
        accent: JOB_TIMELINE.pendingSoft,
        dotColor: JOB_TIMELINE.pendingDot,
        isActive: false,
        isCompleted: false,
        icon: FileText,
      });
    }

    const statusNorm = ((request.status as any) || '').toString().toLowerCase();
    const workOrderConfirmed =
      statusNorm === 'scheduled' ||
      request.status === 'in_progress' ||
      request.status === 'reviewing' ||
      request.status === 'completed' ||
      (quotationAccepted && !!paymentTransaction);

    // Step 5: Work order
    if (workOrderConfirmed) {
      timeline.push({
        id: 'step-5',
        title: 'Work order',
        description: 'Job started.',
        status: formatTimeAgo(request.updatedAt || paymentTransaction?.createdAt || ''),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: CheckCircle2,
      });
    } else if (quotationAccepted) {
      timeline.push({
        id: 'step-5',
        title: 'Work order',
        description: 'Complete payment to confirm.',
        status: 'Waiting',
        accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
        isActive: true,
        isCompleted: false,
        icon: Clock,
      });
    } else {
      timeline.push({
        id: 'step-5',
        title: 'Work order',
        description: 'Accept a quote first.',
        status: 'Pending',
        accent: JOB_TIMELINE.pendingSoft,
        dotColor: JOB_TIMELINE.pendingDot,
        isActive: false,
        isCompleted: false,
        icon: Wrench,
      });
    }

    // Step 6: Work started
    if (request.status === 'in_progress') {
      timeline.push({
        id: 'step-6',
        title: 'Work started',
        description: 'Provider is working.',
        status: 'Active',
        accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
        isActive: true,
        isCompleted: false,
        icon: Wrench,
      });
    } else if (request.status === 'reviewing' || request.status === 'completed') {
      timeline.push({
        id: 'step-6',
        title: 'Work started',
        description: 'Work finished.',
        status: formatTimeAgo(request.updatedAt || ''),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: Wrench,
      });
    } else if (statusNorm === 'scheduled') {
      timeline.push({
        id: 'step-6',
        title: 'Work started',
        description: 'Waiting for provider to start.',
        status: 'Waiting',
        accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
        isActive: true,
        isCompleted: false,
        icon: Wrench,
      });
    } else {
      timeline.push({
        id: 'step-6',
        title: 'Work started',
        description: 'Starts after work order is confirmed.',
        status: 'Pending',
        accent: JOB_TIMELINE.pendingSoft,
        dotColor: JOB_TIMELINE.pendingDot,
        isActive: false,
        isCompleted: false,
        icon: Wrench,
      });
    }

    // Step 7: Complete
    if (request.status === 'completed') {
      timeline.push({
        id: 'step-7',
        title: 'Complete',
        description: 'Job closed. You can leave a review.',
        status: formatTimeAgo(request.updatedAt || request.createdAt),
        accent: JOB_TIMELINE.completeSoft,
        dotColor: JOB_TIMELINE.sage,
        isActive: false,
        isCompleted: true,
        icon: CheckCircle2,
      });
    } else if (request.status === 'reviewing') {
      timeline.push({
        id: 'step-7',
        title: 'Complete',
        description: 'Confirm when you are satisfied.',
        status: 'Review',
        accent: JOB_TIMELINE.activeSoft,
        dotColor: JOB_TIMELINE.activeDot,
        isActive: true,
        isCompleted: false,
        icon: CheckCircle2,
      });
    } else {
      timeline.push({
        id: 'step-7',
        title: 'Complete',
        description: 'Final step after the work is done.',
        status: 'Pending',
        accent: JOB_TIMELINE.pendingSoft,
        dotColor: JOB_TIMELINE.pendingDot,
        isActive: false,
        isCompleted: false,
        icon: CheckCircle2,
      });
    }

    return timeline;
  }, [request, acceptedProviders, quotations, selectionCountdown, paymentTransaction]);

  const timelineHeader = useMemo(() => {
    if (!request) return null;
    const hasAcceptedProviders = (acceptedProviders && acceptedProviders.length > 0) || !!request.selectedProvider;
    const qListH = Array.isArray(quotations) ? quotations : [];
    const hasQuotationSent = jobHasSentQuotation(qListH, request as Record<string, unknown>);
    const acceptedQuotation = qListH.find((q: any) => q?.status === 'accepted');
    const quotationAccepted = !!acceptedQuotation;
    const formatCurrency = (v: number | undefined | null) => (typeof v === 'number' ? v : 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const headerProvider = acceptedQuotation?.provider ?? acceptedProviders?.[0]?.provider ?? null;

    if (request.status === 'completed') return { title: 'Job completed', subtitle: 'Job complete. Funds released to provider. Thank you.', statusPill: 'Completed', pillBg: JOB_TIMELINE.completeSoft, pillText: JOB_TIMELINE.sageChipText, timestamp: request.updatedAt ? formatTimeAgo(request.updatedAt) : null, provider: headerProvider };
    if (request.status === 'in_progress') return { title: 'Job in progress', subtitle: 'Provider is on site. Mark complete when satisfied.', statusPill: 'In progress', pillBg: JOB_TIMELINE.activeSoft, pillText: JOB_TIMELINE.activeChipText, timestamp: request.updatedAt ? formatTimeAgo(request.updatedAt) : null, provider: headerProvider };
    if (request.status === 'reviewing') return { title: 'Provider has finished', subtitle: 'Verify the work is satisfactory, then tap Mark as complete to release payment.', statusPill: 'Awaiting your confirmation', pillBg: JOB_TIMELINE.activeSoft, pillText: JOB_TIMELINE.activeChipText, timestamp: request.updatedAt ? formatTimeAgo(request.updatedAt) : null, provider: headerProvider };

    const statusLower = typeof (request.status as any) === 'string' ? (request.status as any).toLowerCase() : (request.status as any);
    const isPaidByStatus = statusLower === 'scheduled' || statusLower === 'in_progress' || statusLower === 'reviewing' || statusLower === 'completed';
    const isPaymentConfirmed = cameFromPaymentSuccess || (quotationAccepted && (isPaidByStatus || !!paymentTransaction));

    if (isPaymentConfirmed) {
      const amt = acceptedQuotation ? `₦${formatCurrency(acceptedQuotation.total)}` : '';
      return { title: 'Payment secured', subtitle: amt ? `Payment of ${amt} secured in escrow.` : 'Payment secured. Waiting for provider to start.', statusPill: 'Payment confirmed', pillBg: JOB_TIMELINE.completeSoft, pillText: JOB_TIMELINE.sageChipText, timestamp: null, provider: headerProvider };
    }
    if (quotationAccepted && !isPaymentConfirmed) {
      const amt = acceptedQuotation ? `₦${formatCurrency(acceptedQuotation.total)}` : '';
      return { title: 'Quotation accepted, payment required', subtitle: amt ? `Accepted ${amt}. Complete payment to secure the job.` : 'Complete payment to secure the job.', variant: 'action' as const, showPayButton: true, payAmount: acceptedQuotation?.total ?? 0, acceptedQuotation, statusPill: 'Payment required', pillBg: JOB_TIMELINE.activeSoft, pillText: JOB_TIMELINE.activeChipText, timestamp: null, provider: headerProvider };
    }
    if (hasQuotationSent) return { title: 'Quotation received', subtitle: 'Review cost and details, then accept or decline.', statusPill: 'Quote submitted', pillBg: JOB_TIMELINE.infoSoft, pillText: JOB_TIMELINE.infoChipText, timestamp: null, provider: headerProvider };
    if (statusLower === 'quoting' && hasAcceptedProviders) {
      return {
        title: 'Awaiting quotation',
        subtitle: 'Your provider is preparing a quote for this job.',
        statusPill: 'Quoting',
        pillBg: JOB_TIMELINE.infoSoft,
        pillText: JOB_TIMELINE.infoChipText,
        timestamp: request.updatedAt ? formatTimeAgo(request.updatedAt) : null,
        provider: headerProvider,
      };
    }
    if (hasAcceptedProviders) {
      const firstAccept = acceptedProviders?.[0];
      const acceptedAt = firstAccept?.acceptance?.acceptedAt ?? request.updatedAt ?? request.selectedAt;
      const vr = (request as any)?.visitRequest;
      const visitStatus = getVisitLogisticsStatus(vr);
      const visitDeclined = isVisitDeclined(vr);
      const hasVR = resolveVisitOccurred({
        visitRequest: vr,
        requestStatus: request.status,
        quotations: qListH,
      });
      const vPaid = isVisitPaid(vr);
      const parseVisitFee = (value: unknown): number | undefined => {
        if (value == null || value === '') return undefined;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (typeof value === 'string') {
          const parsed = Number(value.replace(/[₦,\s]/g, ''));
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      };
      const logisticsCost =
        parseVisitFee(vr?.logisticsCost) ??
        parseVisitFee(vr?.logistics_cost) ??
        parseVisitFee(vr?.logisticsFee) ??
        parseVisitFee(vr?.logistics_fee) ??
        parseVisitFee(vr?.visitFee) ??
        parseVisitFee(vr?.visit_fee) ??
        parseVisitFee(vr?.inspectionFee) ??
        parseVisitFee(vr?.inspection_fee) ??
        parseVisitFee(vr?.amount) ??
        parseVisitFee((request as any)?.logisticsCost) ??
        parseVisitFee((request as any)?.logistics_cost) ??
        parseVisitFee((request as any)?.visitFee) ??
        parseVisitFee((request as any)?.visit_fee) ??
        parseVisitFee((request as any)?.inspectionFee) ??
        parseVisitFee((request as any)?.inspection_fee);
      const hasPayableVisitFee = typeof logisticsCost === 'number' && logisticsCost > 0;

      const canDeclineVisit = canClientDeclineVisit({
        visitRequest: vr,
        providerHasAccepted: true,
        visitDeclined,
        hasQuotationSent,
      });

      if (__DEV__ && canDeclineVisit) {
        console.log('[OngoingJobDetails] visit header data', {
          requestId: params.requestId,
          rawVisitRequest: vr,
          logisticsCost,
          hasPayableVisitFee,
          visitStatus,
          vPaid,
          visitDeclined,
        });
      }

      if (visitDeclined && !hasQuotationSent) {
        return {
          title: 'Visit declined',
          subtitle: `${getVisitDeclinedDescription(vr, 'client')} Provider can request a new visit or send a quotation.`,
          statusPill: 'Declined',
          pillBg: JOB_TIMELINE.declinedSoft,
          pillText: JOB_TIMELINE.declinedChipText,
          timestamp: acceptedAt ? formatTimeAgo(acceptedAt) : null,
          provider: headerProvider,
        };
      }

      const visitSent =
        isProviderVisitRequestSent(vr) || vPaid || isVisitCompletedOrPaid(vr);

      if (visitSent) {
        const awaitingQuote =
          !hasQuotationSent &&
          (vPaid || isVisitCompletedOrPaid(vr)) &&
          !(canDeclineVisit && hasPayableVisitFee);

        if (awaitingQuote) {
          return {
            title: 'Awaiting quotation',
            subtitle: 'The site visit is done. Your provider will send a quote shortly.',
            statusPill: 'Quoting',
            pillBg: JOB_TIMELINE.infoSoft,
            pillText: JOB_TIMELINE.infoChipText,
            timestamp: acceptedAt ? formatTimeAgo(acceptedAt) : null,
            provider: headerProvider,
          };
        }

        return {
          title: 'Inspection in progress',
          subtitle:
            canDeclineVisit && hasPayableVisitFee
              ? 'Visit scheduled. Pay the inspection fee or decline if you prefer a quote without a site visit.'
              : vPaid || isVisitCompletedOrPaid(vr)
                ? 'The site visit is confirmed. Your provider will inspect and follow up with a quote.'
                : 'Visit requested. Waiting for visit details.',
          statusPill: 'Inspecting',
          pillBg: JOB_TIMELINE.infoSoft,
          pillText: JOB_TIMELINE.infoChipText,
          timestamp: acceptedAt ? formatTimeAgo(acceptedAt) : null,
          provider: headerProvider,
          showVisitPayButton: canDeclineVisit && hasPayableVisitFee,
          showDeclineVisitButton: canDeclineVisit,
          visitLogisticsCost: logisticsCost,
          onVisitPay: () => {
            if (params.requestId == null) return;
            if (!hasPayableVisitFee) {
              showError('The visit fee is not ready yet. Swipe down to refresh, or ask your provider to resend the visit details.');
              return;
            }
            haptics.light();
            router.push({
              pathname: '/ConfirmWalletPaymentScreen',
              params: {
                requestId: params.requestId,
                amount: String(logisticsCost),
                paymentType: 'logistics_fee',
                serviceName: request?.jobTitle || 'Inspection',
              },
            } as any);
          },
          onVisitDecline: () => {
            declineVisitActionRef.current();
          },
        };
      }

      return {
        title: 'Provider accepted',
        subtitle: 'Waiting for inspection or quotation.',
        statusPill: 'Provider accepted',
        pillBg: JOB_TIMELINE.completeSoft,
        pillText: JOB_TIMELINE.sageChipText,
        timestamp: acceptedAt ? formatTimeAgo(acceptedAt) : null,
        provider: headerProvider,
      };
    }
    return { title: 'Waiting for providers', subtitle: 'Nearby providers are being notified. Updates will appear here.', statusPill: 'Pending', pillBg: JOB_TIMELINE.pendingSoft, pillText: JOB_TIMELINE.pendingChipText, timestamp: null, provider: null };
  }, [request, acceptedProviders, quotations, cameFromPaymentSuccess, paymentTransaction]);

  const isPaymentConfirmed = useMemo(() => {
    if (cameFromPaymentSuccess) return true;
    if (!request) return false;
    const qList = Array.isArray(quotations) ? quotations : [];
    const acceptedQuotation = qList.find((q: any) => q?.status === 'accepted');
    if (!acceptedQuotation) return false;
    const statusLower = (request.status || '').toString().toLowerCase();
    const isPaidByStatus =
      statusLower === 'scheduled' ||
      request.status === 'in_progress' ||
      request.status === 'reviewing' ||
      request.status === 'completed';
    return isPaidByStatus || !!paymentTransaction;
  }, [request, quotations, paymentTransaction, cameFromPaymentSuccess]);

  const currentQuotation =
    quotations.length > 0 && currentQuoteIndex < quotations.length
      ? quotations[currentQuoteIndex]
      : null;

  const hasQuotationSent = useMemo(() => {
    const qList = Array.isArray(quotations) ? quotations : [];
    return qList.some(
      (q: any) =>
        q?.sentAt ||
        q?.submittedAt ||
        (q?.status && q?.status !== 'draft') ||
        (q?.total != null && q?.total > 0)
    );
  }, [quotations]);

  const quotationAccepted = useMemo(() => {
    const qList = Array.isArray(quotations) ? quotations : [];
    return qList.some((q: any) => q?.status === 'accepted');
  }, [quotations]);

  const showPaymentSyncHint = quotationAccepted && !isPaymentConfirmed;

  // Load quotations from API (6.3 endpoint)
  const loadQuotations = useCallback(async () => {
    if (!params.requestId) return;
    
    setIsLoadingQuotations(true);
    try {
      const requestId = parseInt(params.requestId, 10);
      const quotationsData = await serviceRequestService.getQuotations(requestId);
      setQuotations(quotationsData);
    } catch (error: any) {
      if (isConnectivityOrNetworkError(error)) {
        if (__DEV__) {
          console.warn('Quotations: offline — staying on screen.');
        }
        setQuotations([]);
        return;
      }
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('Error loading quotations:', error);
      }
      // Don't show error toast - quotations might not exist yet
      setQuotations([]);
    } finally {
      setIsLoadingQuotations(false);
    }
  }, [params.requestId]);

  // Helper function to format countdown
  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Check wallet transactions for payment status (fallback when backend status is stale)
  const checkPaymentTransaction = useCallback(async (requestId: number) => {
    try {
      const result = await walletService.getTransactions({ limit: 100, offset: 0 });
      const reqIdStr = String(requestId);
      const paymentTx = result.transactions.find((tx: any) => {
        const type = (tx.type || '').toLowerCase();
        const status = (tx.status || '').toLowerCase();
        if (status !== 'completed') return false;
        if (!['payment', 'service_payment', 'payment_for_service', 'debit'].includes(type)) return false;
        if (tx.requestId === requestId || tx.requestId === reqIdStr) return true;
        const desc = (tx.description || tx.narration || tx.reference || '').toLowerCase();
        if (desc.includes(`request #${requestId}`) || desc.includes(`request ${requestId}`)) return true;
        if ((tx.metadata?.requestId ?? tx.metadata?.request_id) == requestId) return true;
        return false;
      });
      
      if (paymentTx) {
        setPaymentTransaction(paymentTx);
      } else {
        setPaymentTransaction(null);
      }
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      setPaymentTransaction(null);
    }
  }, []);

  const loadRequestData = useCallback(async (silent = false) => {
    if (!params.requestId) return;

    setHasAttemptedLoad(true);
    if (!silent) setIsLoading(true);
    try {
      const requestId = parseInt(params.requestId, 10);

      // 1) Load core request details (list fallback when GET /requests/:id returns 5xx)
      const { request: requestDetails, usedListFallback } =
        await serviceRequestService.getRequestDetailsWithListFallback(requestId);
      const hydratedRequestDetails = await mergeCachedVisitRequest(requestId, requestDetails);
      if (__DEV__) {
        void logDevAuthTokens('OngoingJobDetails');
        console.log('[OngoingJobDetails] request details loaded', {
          requestId,
          status: hydratedRequestDetails?.status,
          visitRequest: (hydratedRequestDetails as any)?.visitRequest,
          rawVisitKeys: (hydratedRequestDetails as any)?.visitRequest
            ? Object.keys((hydratedRequestDetails as any).visitRequest)
            : [],
          usedListFallback,
        });
        const visitStatus = getVisitLogisticsStatus((hydratedRequestDetails as any)?.visitRequest);
        const requestStatus = (hydratedRequestDetails?.status || '').toString().toLowerCase();
        if (requestStatus === 'cancelled' && isVisitDeclined((hydratedRequestDetails as any)?.visitRequest)) {
          console.warn('[OngoingJobDetails] decline visit may have cancelled the whole request', {
            requestId,
            requestStatus,
            visitStatus,
            visitRequest: (hydratedRequestDetails as any)?.visitRequest,
          });
        }
      }
      setRequest(healJobStatusAfterVisitDecline(hydratedRequestDetails));
      if (usedListFallback && !silent) {
        showWarning(
          'We could not load the latest job details. Showing what we have. Swipe down to refresh.'
        );
      }

      // 2) Check wallet transactions for payment (fallback when backend status is stale)
      await checkPaymentTransaction(requestId).catch(() => {});

      // 3) Load accepted providers (needed for timeline / provider cards)
        try {
          const providers = await serviceRequestService.getAcceptedProviders(requestId);
          const providersArray = Array.isArray(providers) ? providers : [];
          setAcceptedProviders(providersArray);
        } catch (error: any) {
          if (error instanceof AuthError) {
            await handleAuthErrorRedirect(router);
            return;
          }
          // Backend may return 400 e.g. "column provider.image does not exist" – treat as non-fatal
          const msg = String(error?.message || '').toLowerCase();
          const isBackendSchemaError = error?.status === 400 && (msg.includes('provider.image') || msg.includes('does not exist'));
          if (__DEV__ && !isBackendSchemaError) {
            console.error('❌ [OngoingJobDetails] Error loading accepted providers:', {
              requestId,
              error: error?.message || error,
              status: error?.status,
            });
          }
          setAcceptedProviders([]);
        }

      // 4) Load quotations (needed for quotation tab and payment state)
      await loadQuotations();
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        const quiet500 = error?.status === 500 || (error as any)?.isExpected500;
        if (quiet500) console.warn('Error loading request data:', error?.message || error);
        else console.error('Error loading request data:', error);
      }
      const errorMessage = getSpecificErrorMessage(error, 'get_request_details');
      showError(errorMessage);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [params.requestId, loadQuotations, showError, showWarning, checkPaymentTransaction]);

  // Handle provider selection
  const handleSelectProvider = useCallback(async (providerId: number) => {
    if (!params.requestId || isSelectingProvider) return;

    setIsSelectingProvider(true);
    haptics.light();

    try {
      const requestId = parseInt(params.requestId, 10);
      const response = await serviceRequestService.selectProvider(requestId, providerId);
      
      haptics.success();
      showSuccess(response.message || 'Provider selected. They have 5 minutes to accept.');
      
      // Reload request data to get updated selection info
      await loadRequestData();
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('Error selecting provider:', error);
      }
      haptics.error();
      const errorMessage = getSpecificErrorMessage(error, 'select_provider');
      showError(errorMessage);
    } finally {
      setIsSelectingProvider(false);
    }
  }, [params.requestId, isSelectingProvider, showSuccess, showError, loadRequestData]);

  // Countdown timer for selection
  // Uses backend's selectionTimeoutAt if available, otherwise calculates from selectedAt + 5 minutes
  const startCountdownTimer = useCallback(() => {
    if (!request?.selectedAt) {
      setSelectionCountdown(null);
      return;
    }

    const updateCountdown = () => {
      try {
        // Prefer backend's selectionTimeoutAt if available, otherwise calculate it
        let timeoutTime: number;
        if (request.selectionTimeoutAt) {
          // Use backend's timeout time (more accurate)
          timeoutTime = new Date(request.selectionTimeoutAt).getTime();
        } else {
          // Fallback: calculate from selectedAt + 5 minutes
          const selectedTime = new Date(request.selectedAt!).getTime();
          timeoutTime = selectedTime + (5 * 60 * 1000); // 5 minutes
        }
        
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((timeoutTime - now) / 1000)); // seconds

        if (remaining > 0) {
          setSelectionCountdown(remaining);
        } else {
          setSelectionCountdown(null);
          // Selection timed out - reload to get updated status from backend
          loadRequestData();
        }
      } catch (error) {
        setSelectionCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [request?.selectedAt, request?.selectionTimeoutAt, loadRequestData]);

  // Start countdown when selection is active
  useEffect(() => {
    if (request?.selectedAt && !request.selectedProvider && request.status === 'pending') {
      const cleanup = startCountdownTimer();
      return cleanup;
    } else {
      setSelectionCountdown(null);
    }
  }, [request?.selectedAt, request?.selectedProvider, request?.status, request?.selectionTimeoutAt, startCountdownTimer]);

  // Proximity data for TimelineStatusCard provider row
  const mappedProviders = useMemo(() => {
    if (!acceptedProviders || acceptedProviders.length === 0) return [];
    return acceptedProviders.map((item) => ({
      providerId: item.provider.id,
      distanceKm: item.distanceKm,
      minutesAway: item.minutesAway,
    }));
  }, [acceptedProviders]);

  const lastRequestIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Reset loaded flags when viewing a different job
  useEffect(() => {
    if (params.requestId !== lastRequestIdRef.current) {
      lastRequestIdRef.current = params.requestId ?? null;
      hasLoadedRef.current = false;
    }
  }, [params.requestId]);

  // Initial load handled by useFocusEffect – avoids double load + flash

  // Refresh when screen focuses + poll when job is active (scheduled, in_progress, reviewing)
  const loadRequestDataRef = useRef(loadRequestData);
  loadRequestDataRef.current = loadRequestData;

  useFocusEffect(
    useCallback(() => {
      if (!params.requestId) return;

      // First focus: full load with spinner. Later: silent load (no loading flash)
      const initTimer = setTimeout(() => {
        loadRequestDataRef.current(hasLoadedRef.current);
        hasLoadedRef.current = true;
      }, 50);

      // Poll every 15s (was 5s – reduced to limit log spam when backend has errors)
      const poll = () => loadRequestDataRef.current(true);
      const pollInterval = setInterval(poll, 15000);
      const firstPollTimer = setTimeout(poll, 5000);

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') poll();
      });

      return () => {
        clearTimeout(initTimer);
        clearTimeout(firstPollTimer);
        clearInterval(pollInterval);
        sub.remove();
      };
    }, [params.requestId])
  );


  const performDeclineVisit = useCallback(async () => {
    const rid = Number(params.requestId);
    if (isNaN(rid) || isDecliningVisit) return;

    setIsDecliningVisit(true);
    try {
      const declineResponse = await serviceRequestService.declineVisit(rid);
      if (__DEV__) {
        console.log('[OngoingJobDetails] decline visit completed', {
          requestId: rid,
          declineResponse,
        });
      }

      const visitStatusFromApi =
        typeof declineResponse?.visitStatus === 'string' ? declineResponse.visitStatus : undefined;
      const declinedVisit = patchVisitDeclined(
        {
          ...((request as any)?.visitRequest || {}),
          ...(visitStatusFromApi ? { logisticsStatus: visitStatusFromApi } : {}),
        },
        'client',
      );

      await saveCachedVisitRequest(rid, declinedVisit);
      setRequest((prev) => {
        if (!prev) return prev;
        return healJobStatusAfterVisitDecline({
          ...prev,
          visitRequest: declinedVisit,
        } as ServiceRequest);
      });

      haptics.success();
      showSuccess(
        declineResponse?.message ||
          'Visit declined. Your job is still active, and the provider can send a quotation.',
      );
      setDeclineVisitModalVisible(false);

      await loadRequestData(true);
      setRequest((prev) => {
        if (!prev) return prev;
        if (isVisitDeclined((prev as any)?.visitRequest)) {
          return healJobStatusAfterVisitDecline(prev);
        }
        return healJobStatusAfterVisitDecline({
          ...prev,
          visitRequest: declinedVisit,
        } as ServiceRequest);
      });
    } catch (e: any) {
      if (e instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      haptics.error();
      const raw = (e?.message || e?.details?.data?.error || '').toString().toLowerCase();
      const noVisitRequested = raw.includes('no visit') && raw.includes('requested');
      const msg = getSpecificErrorMessage(e, 'decline_visit') ?? e?.message ?? 'Failed to decline visit.';
      if (noVisitRequested) {
        showInfo(msg);
        setDeclineVisitModalVisible(false);
        await loadRequestData(true);
      } else {
        showError(msg);
      }
    } finally {
      setIsDecliningVisit(false);
    }
  }, [
    params.requestId,
    request,
    loadRequestData,
    router,
    showError,
    showSuccess,
    isDecliningVisit,
  ]);

  const confirmDeclineVisit = useCallback(() => {
    haptics.light();
    setDeclineVisitModalVisible(true);
  }, []);

  declineVisitActionRef.current = confirmDeclineVisit;

  const handleAcceptQuotation = async (quotationId: number) => {
    if (!params.requestId || isQuotationActionLoading) return;

    try {
      setIsQuotationActionLoading(true);
      const response = await serviceRequestService.acceptQuotation(quotationId);

      haptics.success();
      showSuccess(response.message || 'Quotation accepted. Tap Pay when you are ready.');

      await loadRequestData(true);
      setActiveTab('Quotations');
        } catch (error: any) {
          if (error instanceof AuthError) {
            await handleAuthErrorRedirect(router);
            return;
          }
          if (__DEV__) {
            console.error('Error accepting quotation:', error);
          }
          haptics.error();
          const errorMessage = getSpecificErrorMessage(error, 'accept_quotation');
          showError(errorMessage);
    } finally {
      setIsQuotationActionLoading(false);
    }
  };


  const handleRejectQuotation = async (quotationId: number) => {
    if (!params.requestId || isQuotationActionLoading) return;

    try {
      setIsQuotationActionLoading(true);
      const response = await serviceRequestService.rejectQuotation(quotationId);

      haptics.success();
      showSuccess(response.message || 'Quotation rejected.');

      await loadQuotations();


      const currentIndex = quotations.findIndex(q => q.id === quotationId);
      if (currentIndex >= 0 && quotations.length > 1) {
        const nextIndex = currentIndex < quotations.length - 1 ? currentIndex : currentIndex - 1;
        if (nextIndex >= 0) {
          setCurrentQuoteIndex(nextIndex);
        }
      } else if (quotations.length === 1) {

        setCurrentQuoteIndex(0);
      }
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('Error rejecting quotation:', error);
      }
      haptics.error();
      const errorMessage = getSpecificErrorMessage(error, 'reject_quotation');
      showError(errorMessage);
    } finally {
      setIsQuotationActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (completeJobLockRef.current || isLoading || !params.requestId || !request) return;

    const statusNorm = (request.status || '').toString().toLowerCase().replace(/[\s_-]/g, '');
    if (statusNorm !== 'reviewing') return;

    showAppAlert(
      'Complete Job',
      'Are you sure the service has been completed? This will transfer payment to the provider.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => haptics.light(),
        },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            if (completeJobLockRef.current) return;
            completeJobLockRef.current = true;
            try {
              setIsLoading(true);
              haptics.light();

              if (!params.requestId) return;
              const requestId = parseInt(params.requestId, 10);
              const response = await serviceRequestService.completeServiceRequest(requestId);

              haptics.success();
              showSuccess(response.message || 'Job completed. Payment was sent to the provider.');

              await loadRequestData();

              setTimeout(() => {
                router.replace({
                  pathname: '/CompletedJobDetail',
                  params: { requestId: params.requestId },
                } as any);
              }, 800);
            } catch (error: any) {
              if (isDuplicateActionError(error, ['complete', 'completed'])) {
                haptics.success();
                showSuccess('This job was already completed.');
                await loadRequestData();
                setTimeout(() => {
                  router.replace({
                    pathname: '/CompletedJobDetail',
                    params: { requestId: params.requestId },
                  } as any);
                }, 800);
                return;
              }
              if (error instanceof AuthError) {
                completeJobLockRef.current = false;
                await handleAuthErrorRedirect(router);
                return;
              }
              if (__DEV__) {
                console.error('Error completing job:', error);
              }
              haptics.error();
              completeJobLockRef.current = false;
              const errorMessage = getSpecificErrorMessage(error, 'complete_service_request');
              showError(errorMessage);
              setIsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    if (activeTab === 'Quotations') {
      setCurrentQuoteIndex(0);
    }
    // Ensure currentQuoteIndex is within bounds
    if (quotations.length > 0 && currentQuoteIndex >= quotations.length) {
      setCurrentQuoteIndex(0);
    }
  }, [activeTab, quotations, currentQuoteIndex]);

  useEffect(() => {
    quoteCardAnim.setValue(0);
    Animated.timing(quoteCardAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentQuoteIndex, quoteCardAnim]);

  const renderTimelineStepActions = useCallback(
    (step: JobProgressStep) => {
      const actions: React.ReactNode[] = [];

      if (
        step.id === 'step-4' &&
        step.isActive &&
        hasQuotationSent &&
        !quotationAccepted
      ) {
        actions.push(
          <SageOutlineChip key="review" label="Review quote" onPress={openQuotationsTab} />
        );
      }

      if (step.showPayService) {
        actions.push(
          <SagePrimaryButton
            key="pay-service"
            compact
            label={`Pay Now (₦${(step.payAmount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`}
            onPress={() => {
              haptics.light();
              const quote = step.acceptedQuotation as { id?: number; provider?: { name?: string } } | undefined;
              router.push({
                pathname: '/ConfirmWalletPaymentScreen' as any,
                params: {
                  requestId: params.requestId,
                  amount: String(step.payAmount ?? 0),
                  quotationId: quote?.id?.toString(),
                  providerName: quote?.provider?.name || 'Service Provider',
                  serviceName: request?.jobTitle || 'Service Request',
                  paymentType: 'service' as const,
                },
              } as any);
            }}
          />
        );
      }

      if (step.showPayLogistics && step.isActive) {
        actions.push(
          <SagePrimaryButton
            key="pay-visit"
            compact
            label={`Pay visit fee • ₦${Number(step.logisticsCost ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            onPress={() => {
              haptics.light();
              router.push({
                pathname: '/ConfirmWalletPaymentScreen' as any,
                params: {
                  requestId: params.requestId,
                  amount: String(step.logisticsCost ?? 0),
                  paymentType: 'logistics_fee' as const,
                  serviceName: request?.jobTitle || 'Inspection',
                },
              } as any);
            }}
          />
        );
      }

      if (step.showRejectVisit && step.isActive) {
        actions.push(
          <DestructiveButton
            key="decline-visit"
            compact
            label="Decline visit"
            onPress={() => {
              confirmDeclineVisit();
            }}
          />
        );
      }

      if (
        (step.id === 'step-5' || step.id === 'step-4') &&
        step.isActive &&
        quotationAccepted &&
        !isPaymentConfirmed
      ) {
        const acceptedQuote = quotations.find((q: any) => q?.status === 'accepted');
        if (acceptedQuote) {
          actions.push(
            <SagePrimaryButton
              key="pay-now"
              compact
              label={`Pay Now (₦${acceptedQuote.total.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`}
              onPress={() => {
                haptics.light();
                router.push({
                  pathname: '/ConfirmWalletPaymentScreen' as any,
                  params: {
                    requestId: params.requestId,
                    amount: acceptedQuote.total.toString(),
                    quotationId: acceptedQuote.id.toString(),
                    providerName: acceptedQuote.provider.name,
                    serviceName: request?.jobTitle || 'Service Request',
                  },
                } as any);
              }}
            />
          );
        }
      }

      if (actions.length === 0) return null;
      return <InlineActionsRow>{actions}</InlineActionsRow>;
    },
    [
      hasQuotationSent,
      quotationAccepted,
      isPaymentConfirmed,
      confirmDeclineVisit,
      openQuotationsTab,
      params.requestId,
      quotations,
      request?.jobTitle,
      router,
      showError,
      showSuccess,
    ]
  );

  const renderQuotationFooter = () => {
    if (!currentQuotation) return null;

    const quoteStatus = currentQuotation.status;
    const canAccept = quoteStatus !== 'rejected' && quoteStatus !== 'accepted';
    const canReject = canAccept;
    const isAccepted = quoteStatus === 'accepted';
    const isRejected = quoteStatus === 'rejected';
    const showPayNow = isAccepted && !isPaymentConfirmed;

    return (
      <View
        style={{
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
        }}
      >
        {canAccept ? (
          <TouchableOpacity
            activeOpacity={0.85}
            className="rounded-xl py-4 items-center justify-center mb-3"
            accessibilityRole="button"
            accessibilityLabel="Accept quote"
            disabled={isQuotationActionLoading || isLoadingQuotations}
            style={{
              backgroundColor: Colors.accent,
              opacity: isQuotationActionLoading || isLoadingQuotations ? 0.5 : 1,
            }}
            onPress={async () => {
              if (currentQuotation.id) {
                haptics.light();
                analytics.track('accept_quote', {
                  job_id: params.requestId,
                  quotation_id: currentQuotation.id,
                  provider_id: currentQuotation.provider.id,
                });
                await handleAcceptQuotation(currentQuotation.id);
              } else {
                showError('Invalid quotation. Please try again.');
              }
            }}
          >
            {isQuotationActionLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text className="text-white text-base" style={{ fontFamily: 'Poppins-SemiBold' }}>
                Accept Quote
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {canReject ? (
          <TouchableOpacity
            activeOpacity={0.85}
            className="bg-white rounded-xl py-4 items-center justify-center border-2 mb-3"
            accessibilityRole="button"
            accessibilityLabel="Reject quote"
            disabled={isQuotationActionLoading || isLoadingQuotations}
            style={{
              borderColor: Colors.border,
              opacity: isQuotationActionLoading || isLoadingQuotations ? 0.5 : 1,
            }}
            onPress={async () => {
              if (currentQuotation.id) {
                haptics.light();
                analytics.track('reject_quote', {
                  job_id: params.requestId,
                  quotation_id: currentQuotation.id,
                  provider_id: currentQuotation.provider.id,
                });
                await handleRejectQuotation(currentQuotation.id);
              } else {
                showError('Invalid quotation. Please try again.');
              }
            }}
          >
            {isQuotationActionLoading ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <Text className="text-base" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.error }}>
                Reject Quote
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {isAccepted ? (
          <View
            className="rounded-xl py-3 px-4 items-center justify-center mb-3"
            style={{ backgroundColor: Colors.successLight }}
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color={Colors.successIcon} style={{ marginRight: 8 }} />
              <Text className="text-sm" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.successIcon }}>
                Quotation Accepted
              </Text>
            </View>
            <Text className="text-xs mt-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.successIcon }}>
              {showPayNow ? 'Complete payment to start the job' : 'Payment completed'}
            </Text>
          </View>
        ) : null}

        {showPayNow ? (
          <TouchableOpacity
            activeOpacity={0.85}
            className="rounded-xl py-4 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Pay now"
            style={{ backgroundColor: Colors.accent }}
            onPress={() => {
              if (currentQuotation.id) {
                haptics.light();
                router.push({
                  pathname: '/ConfirmWalletPaymentScreen' as any,
                  params: {
                    requestId: params.requestId,
                    amount: currentQuotation.total.toString(),
                    quotationId: currentQuotation.id.toString(),
                    providerName: currentQuotation.provider.name,
                    serviceName: request?.jobTitle || 'Service Request',
                  },
                } as any);
              } else {
                showError('Invalid quotation. Please try again.');
              }
            }}
          >
            <Text className="text-white text-base" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Pay Now • ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(currentQuotation.total)}
            </Text>
          </TouchableOpacity>
        ) : null}

        {isRejected ? (
          <View
            className="rounded-xl py-3 px-4 items-center justify-center"
            style={{ backgroundColor: Colors.errorLight }}
          >
            <View className="flex-row items-center">
              <Ionicons name="close-circle" size={20} color={Colors.error} style={{ marginRight: 8 }} />
              <Text className="text-sm" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.error }}>
                Quotation Rejected
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };


  return (
    <SafeAreaWrapper edges={['bottom']}>
      {cameFromBooking ? <Stack.Screen options={{ gestureEnabled: false }} /> : null}
      <View style={{ flex: 1, paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingTop: insets.top }}>
        <ScreenHeader
          title="Job Details"
          onBack={handleJobDetailsBack}
          style={{ paddingHorizontal: 0, paddingBottom: Spacing.xxl }}
        />

        {/* Full-width tabs with green underline for active tab */}
        <View className="flex-row border-b" style={{ width: '100%', marginBottom: 4, borderBottomColor: Colors.border }}>
          {TAB_ITEMS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(tab);
                }}
                style={{
                  flex: 1,
                  paddingBottom: 8,
                  alignItems: 'center',
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: isActive ? 'Poppins-Bold' : 'Poppins-Medium',
                    color: isActive ? Colors.textPrimary : Colors.tabInactive,
                  }}
                >
                  {tab}
                </Text>
                <View
                  style={{
                    height: 2,
                    width: '100%',
                    marginTop: 8,
                    backgroundColor: isActive ? Colors.accent : 'transparent',
                    borderRadius: 1,
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View
            style={{ flex: 1, marginTop: 8 }}
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && nextHeight !== contentAreaHeight) {
                setContentAreaHeight(nextHeight);
              }
            }}
          >
            {activeTab === 'Quotations' ? (
              <JobDetailsQuotationsTabSkeleton areaHeight={contentAreaHeight} />
            ) : (
              <JobDetailsContentSkeleton areaHeight={contentAreaHeight} />
            )}
          </View>
        ) : !request && (hasAttemptedLoad || !params.requestId) ? (
          <View className="flex-1 items-center justify-center py-20 px-6" style={{ minHeight: 200 }}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.tabInactive} />
            <Text className="mt-4 text-center px-4" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
              {params.requestId ? 'Unable to load job details. Please try again.' : 'Invalid job. Please go back and try again.'}
            </Text>
            {params.requestId ? (
              <TouchableOpacity
                onPress={() => loadRequestData()}
                className="mt-6 px-6 py-3 rounded-xl" style={{ backgroundColor: Colors.accent }}
                activeOpacity={0.85}
              >
                <Text className="text-white" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  Retry
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : activeTab === 'Updates' ? (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 0 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadRequestData(true);
                  setRefreshing(false);
                }}
                tintColor={Colors.accent}
              />
            }
          >
            {timelineHeader ? (
              <ClientJobUpdatesPanel
                header={timelineHeader as any}
                steps={timelineSteps as JobProgressStep[]}
                mappedProviders={mappedProviders}
                requestId={params.requestId}
                clientIdentity={clientIdentity}
                showSyncHint={showPaymentSyncHint}
                renderStepActions={renderTimelineStepActions}
              />
            ) : null}

            {(() => {
              const statusNorm = (request?.status || '').toString().toLowerCase().replace(/[\s_-]/g, '');
              const canMarkComplete = statusNorm === 'reviewing' && !isLoading;
              if (statusNorm === 'completed') return null;
              return (
                <TouchableOpacity
                  disabled={!canMarkComplete}
                  className="rounded-xl py-4 items-center justify-center mb-8" style={{ backgroundColor: canMarkComplete ? Colors.accent : Colors.border }}
                  activeOpacity={canMarkComplete ? 0.85 : 1}
                  onPress={handleCompleteJob}
                >
                  {isLoading && completeJobLockRef.current ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text
                      className="text-sm"
                      style={{
                        fontFamily: 'Poppins-Medium',
                        color: canMarkComplete ? Colors.white : Colors.iconMuted,
                      }}
                    >
                      {statusNorm === 'reviewing' ? 'Confirm & release payment' : 'Waiting for provider to finish'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16, paddingTop: 0 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={async () => {
                    setRefreshing(true);
                    await loadRequestData(true);
                    setRefreshing(false);
                  }}
                  tintColor={Colors.accent}
                />
              }
            >
                {/* Quote status banner */}
                <View
                  style={{
                    backgroundColor: Colors.white,
                    borderRadius: BorderRadius.xl,
                    paddingVertical: 12,
                    paddingHorizontal: 13,
                    marginBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 0.6,
                    borderColor: Colors.borderLight,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: BorderRadius.full,
                      backgroundColor: Colors.sageTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: 'Poppins-Bold', color: Colors.accent }}>
                      {quotations.length > 0 ? quotations.length : '•'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, marginBottom: 2 }}>
                      {quotations.length > 0 ? 'Quotations ready' : 'Waiting for quotations'}
                    </Text>
                    <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
                      {quotations.length > 0
                        ? 'Compare costs and choose the provider that works best for you.'
                        : 'Provider quotations will appear here once submitted.'}
                    </Text>
                  </View>
                </View>

                {quotations.length > 0 && currentQuoteIndex < quotations.length ? (
                  <>
                    {/* Quotation Card */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        haptics.light();
                        const currentQuote = quotations[currentQuoteIndex];
                        if (currentQuote) {
                          router.push({
                            pathname: '/ProviderDetailScreen',
                            params: {
                              providerId: currentQuote.provider.id.toString(),
                              providerName: currentQuote.provider.name,
                            },
                          } as any);
                        }
                      }}
                    >
                      <Animated.View
                        className="rounded-2xl px-4 py-4 mb-4"
                        style={{
                          backgroundColor: Colors.sageTint,
                          opacity: quoteCardAnim,
                          transform: [
                            {
                              translateY: quoteCardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [20, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <View className="flex-row items-center">
                          <Image
                            source={require('../assets/images/plumbericon2.png')}
                            className="w-14 h-14 rounded-full mr-3"
                            resizeMode="cover"
                          />
                          <View className="flex-1">
                            <View className="flex-row items-center">
                            <Text className="text-base text-black mb-1" style={{ fontFamily: 'Poppins-Bold' }}>
                                {quotations[currentQuoteIndex].provider.name}
                            </Text>
                              {quotations[currentQuoteIndex].provider.verified && (
                                <Ionicons name="checkmark-circle" size={16} color={Colors.accent} style={{ marginLeft: 6 }} />
                              )}
                            </View>
                              <Text className="text-xs mt-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.iconMuted }}>
                              {quotations[currentQuoteIndex].provider.phoneNumber}
                              </Text>
                          </View>
                          <Text className="text-black" style={{ fontFamily: 'Poppins-Bold', fontSize: 20 }}>
                            ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].total)}
                          </Text>
                        </View>
                      </Animated.View>
                    </TouchableOpacity>

                    {/* Quotation Breakdown */}
                    <Animated.View
                      className="mb-4"
                      style={{
                        opacity: quoteCardAnim,
                        transform: [
                          {
                            translateY: quoteCardAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [15, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <Text className="text-base text-black mb-3" style={{ fontFamily: 'Poppins-Bold' }}>
                        Quotation Breakdown
                      </Text>
                      <View className="bg-white rounded-2xl border px-4 py-4" style={{ borderColor: Colors.borderLight }}>
                        <View className="flex-row items-center justify-between mb-3 pb-3 border-b" style={{ borderBottomColor: Colors.borderLight }}>
                            <Text className="text-sm flex-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                            Labor Cost
                            </Text>
                            <Text className="text-sm ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.surfaceDark }}>
                            ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].laborCost)}
                            </Text>
                          </View>
                        <View className="flex-row items-center justify-between mb-3 pb-3 border-b" style={{ borderBottomColor: Colors.borderLight }}>
                          <Text className="text-sm flex-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                            Logistics Cost
                          </Text>
                          <Text className="text-sm ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.surfaceDark }}>
                            ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].logisticsCost)}
                          </Text>
                        </View>
                        {quotations[currentQuoteIndex].materials && quotations[currentQuoteIndex].materials.length > 0 && (
                          <View className="mb-3 pb-3 border-b" style={{ borderBottomColor: Colors.borderLight }}>
                            <Text className="text-sm mb-2" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                              Materials
                            </Text>
                            {quotations[currentQuoteIndex].materials.map((material, index) => {
                              const quantity = material.quantity || 1;
                              const unitPrice = material.unitPrice || 0;
                              const total = quantity * unitPrice;
                              return (
                                <View key={index} className="flex-row items-center justify-between mb-1">
                                  <Text className="text-xs flex-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                                    {material.name} (Qty: {quantity})
                                  </Text>
                                  <Text className="text-xs ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.surfaceDark }}>
                                    ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                        {quotations[currentQuoteIndex].serviceCharge > 0 && (
                          <View className="flex-row items-center justify-between mb-3 pb-3 border-b" style={{ borderBottomColor: Colors.borderLight }}>
                            <Text className="text-sm flex-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                              Service Charge
                            </Text>
                            <Text className="text-sm ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.surfaceDark }}>
                              ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].serviceCharge)}
                            </Text>
                          </View>
                        )}
                        {quotations[currentQuoteIndex].tax > 0 && (
                          <View className="flex-row items-center justify-between mb-3 pb-3 border-b" style={{ borderBottomColor: Colors.borderLight }}>
                            <Text className="text-sm flex-1" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
                              Tax
                            </Text>
                            <Text className="text-sm ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.surfaceDark }}>
                              ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].tax)}
                            </Text>
                          </View>
                        )}
                        <View className="mt-3 pt-3 border-t flex-row items-center justify-between" style={{ borderTopColor: Colors.border }}>
                          <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Bold' }}>
                            Total
                          </Text>
                          <Text className="text-lg" style={{ fontFamily: 'Poppins-Bold', color: Colors.accent }}>
                            ₦{new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotations[currentQuoteIndex].total)}
                          </Text>
                        </View>
                      </View>
                    </Animated.View>

                    {/* Findings & Work Required */}
                    {quotations[currentQuoteIndex].findingsAndWorkRequired && (
                    <Animated.View
                      className="mb-6"
                      style={{
                        opacity: quoteCardAnim,
                        transform: [
                          {
                            translateY: quoteCardAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [15, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <Text className="text-base text-black mb-3" style={{ fontFamily: 'Poppins-Bold' }}>
                          Findings & Work Required
                      </Text>
                      <View className="bg-white rounded-2xl border px-4 py-4" style={{ borderColor: Colors.borderLight }}>
                          <Text className="text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.textMuted, lineHeight: 20 }}>
                            {quotations[currentQuoteIndex].findingsAndWorkRequired}
                            </Text>
                      </View>
                    </Animated.View>
                    )}

                    {/* Navigation & Pagination */}
                    <View className="flex-row items-center justify-between mb-6">
                      <TouchableOpacity
                        onPress={() => {
                          if (currentQuoteIndex > 0) {
                            haptics.selection();
                            setCurrentQuoteIndex(currentQuoteIndex - 1);
                          }
                        }}
                        disabled={currentQuoteIndex === 0}
                        activeOpacity={0.85}
                        className={`flex-row items-center ${currentQuoteIndex === 0 ? 'opacity-40' : ''}`}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={20}
                          color={currentQuoteIndex === 0 ? Colors.tabInactive : Colors.accent}
                        />
                        <Text
                          className="text-sm ml-1"
                          style={{
                            fontFamily: 'Poppins-SemiBold',
                            color: currentQuoteIndex === 0 ? Colors.tabInactive : Colors.accent,
                          }}
                        >
                          Previous
                        </Text>
                      </TouchableOpacity>

                      <Text className="text-sm" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
                        {currentQuoteIndex + 1}/{quotations.length}
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          if (currentQuoteIndex < quotations.length - 1) {
                            haptics.selection();
                            setCurrentQuoteIndex(currentQuoteIndex + 1);
                          }
                        }}
                        disabled={currentQuoteIndex === quotations.length - 1}
                        activeOpacity={0.85}
                        className={`flex-row items-center ${currentQuoteIndex === quotations.length - 1 ? 'opacity-40' : ''}`}
                      >
                        <Text
                          className="text-sm mr-1"
                          style={{
                            fontFamily: 'Poppins-SemiBold',
                            color: currentQuoteIndex === quotations.length - 1 ? Colors.tabInactive : Colors.accent,
                          }}
                        >
                          Next
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={currentQuoteIndex === quotations.length - 1 ? Colors.tabInactive : Colors.accent}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View className="items-center justify-center py-12">
                    <Ionicons name="document-text-outline" size={48} color={Colors.tabInactive} />
                    <Text className="mt-4 text-center" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
                      No quotations available yet.
                    </Text>
                    <Text className="mt-2 text-center text-sm" style={{ fontFamily: 'Poppins-Regular', color: Colors.iconMuted }}>
                      Quotations will appear here once providers submit them.
                    </Text>
                  </View>
                )}
            </ScrollView>
            {renderQuotationFooter()}
          </View>
        )}
      </View>
      <ConfirmModal
        visible={declineVisitModalVisible}
        title="Decline visit?"
        message="Only the site visit is cancelled, not your job. The provider can still send a quotation."
        cancelLabel="Keep visit"
        confirmLabel="Decline visit"
        confirmBackgroundColor={Colors.error}
        loading={isDecliningVisit}
        onCancel={() => {
          if (isDecliningVisit) return;
          haptics.light();
          setDeclineVisitModalVisible(false);
        }}
        onConfirm={() => {
          void performDeclineVisit();
        }}
      />
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}
