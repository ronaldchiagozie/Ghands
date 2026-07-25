import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import { serviceRequestService, profileService, authService } from '@/services/api';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { formatTimeAgo } from '@/utils/dateFormatting';
import { formatSkillLabel } from '@/utils/formatSkillLabel';
import { navigateToJob, navigateToJobsPendingTab, resetToClientTab, NAV_FALLBACK } from '@/utils/navigation';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, Wrench, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ProgressStepStatus = 'completed' | 'in-progress' | 'pending';

interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: ProgressStepStatus;
  statusLabel: string;
}

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    serviceType?: string;
    selectedDate?: string;
    selectedTime?: string;
    providerCount?: string;
  }>();
  const [request, setRequest] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [acceptedProviders, setAcceptedProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const exitToJobs = useCallback(() => {
    haptics.light();
    navigateToJobsPendingTab(router);
  }, [router]);

  useEffect(() => {
    if (!__DEV__) return;
    (async () => {
      try {
        const token = await authService.getAuthToken();
        console.log('[ClientTokenSnippet]', token ? `${String(token).slice(0, 16)}...` : null);
      } catch {
        console.log('[ClientTokenSnippet]', null);
      }
    })();
  }, []);

  const loadData = useCallback(async () => {
    const requestId = params.requestId ? parseInt(params.requestId, 10) : null;
    if (!requestId || isNaN(requestId)) {
      setIsLoading(false);
      return;
    }
    try {
      const [req, provs, quots] = await Promise.all([
        serviceRequestService.getRequestDetails(requestId),
        serviceRequestService.getAcceptedProviders(requestId),
        serviceRequestService.getQuotations(requestId),
      ]);
      setRequest(req);
      setAcceptedProviders(Array.isArray(provs) ? provs : []);
      setQuotations(Array.isArray(quots) ? quots : []);
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      setRequest(null);
      setAcceptedProviders([]);
      setQuotations([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [params.requestId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        exitToJobs();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [exitToJobs])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const progressSteps = useMemo((): ProgressStep[] => {
    const providerCount = params.providerCount
      ? parseInt(params.providerCount, 10)
      : (request?.nearbyProviders?.length ?? acceptedProviders.length ?? 0);
    const totalSent = providerCount > 0 ? providerCount : acceptedProviders.length || 0;
    const sentText =
      totalSent > 0
        ? `Sent to ${totalSent} nearby ${totalSent === 1 ? 'provider' : 'providers'}.`
        : 'Nearby providers will be notified shortly.';

    const hasAccepted =
      acceptedProviders.length > 0 || (request?.status && !['pending'].includes(request.status));
    const quotationCount = quotations.filter((q) => q.sentAt || (q.status && q.status !== null)).length;
    const hasQuotationSent = quotationCount > 0;
    const quotationAccepted = quotations.some((q) => q.status === 'accepted');
    const status = request?.status || 'pending';

    return [
      {
        id: 'step-1',
        title: 'Request submitted',
        description: sentText,
        status: 'completed',
        statusLabel: formatTimeAgo(request?.createdAt || new Date().toISOString()),
      },
      {
        id: 'step-2',
        title: 'Inspection & quote',
        description: hasAccepted
          ? hasQuotationSent
            ? `${quotationCount} quote${quotationCount === 1 ? '' : 's'} received. Review when ready.`
            : 'Provider will inspect and send a quote.'
          : 'Waiting for a provider to accept your request.',
        status: quotationAccepted ? 'completed' : hasAccepted || hasQuotationSent ? 'in-progress' : 'pending',
        statusLabel: quotationAccepted
          ? formatTimeAgo(request?.updatedAt || '')
          : hasQuotationSent
            ? `${quotationCount} received`
            : hasAccepted
              ? 'In progress'
              : 'Up next',
      },
      {
        id: 'step-3',
        title: 'Work begins',
        description:
          status === 'in_progress' || status === 'reviewing'
            ? 'Provider is on site. Track progress from job details.'
            : 'Starts after you accept a quote and pay.',
        status: ['in_progress', 'reviewing', 'scheduled', 'completed'].includes(status)
          ? status === 'completed'
            ? 'completed'
            : 'in-progress'
          : 'pending',
        statusLabel:
          status === 'in_progress' || status === 'reviewing'
            ? 'In progress'
            : status === 'completed'
              ? 'Done'
              : 'Later',
      },
    ];
  }, [request, quotations, acceptedProviders, params.providerCount]);

  const handleContinue = () => {
    haptics.selection();
    if (params.requestId) {
      resetToClientTab(router, NAV_FALLBACK.clientJobs, { initialTab: 'Pending' });
      navigateToJob(router, { requestId: params.requestId, fromBooking: true });
    } else {
      exitToJobs();
    }
  };

  const rawService = params.serviceType || request?.categoryName || request?.jobTitle || '';
  const displayService = formatSkillLabel(rawService) || 'Your service';
  const displayProviderCount = params.providerCount
    ? parseInt(params.providerCount, 10)
    : (request?.nearbyProviders?.length ?? acceptedProviders.length ?? 0);
  const providerSummary =
    displayProviderCount > 0
      ? `${displayProviderCount} ${displayProviderCount === 1 ? 'provider' : 'providers'} notified`
      : 'Matching providers';
  const displayDate = params.selectedDate
    ? (() => {
        try {
          const d = new Date(params.selectedDate);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${months[d.getMonth()]} ${d.getDate()}`;
        } catch {
          return params.selectedDate;
        }
      })()
    : request?.scheduledDate
      ? (() => {
          try {
            const d = new Date(request.scheduledDate);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[d.getMonth()]} ${d.getDate()}`;
          } catch {
            return request.scheduledDate;
          }
        })()
      : null;

  const stepDotColor = (status: ProgressStepStatus) => {
    if (status === 'completed') return JOB_TIMELINE.sage;
    if (status === 'in-progress') return JOB_TIMELINE.activeDot;
    return JOB_TIMELINE.pendingDot;
  };

  const stepIcon = (index: number) => {
    if (index === 0) return CheckCircle2;
    if (index === 1) return FileText;
    return Wrench;
  };

  if (params.requestId && isLoading) {
    return (
      <SafeAreaWrapper className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text className="text-gray-500 mt-4" style={{ fontFamily: 'Poppins-Medium' }}>
            Loading…
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper className="flex-1 bg-white">
      <Stack.Screen options={{ gestureEnabled: false }} />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={exitToJobs}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.7}
        >
          <X size={22} color={Colors.textSecondaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        refreshControl={
          params.requestId ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.accent]} />
          ) : undefined
        }
      >
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 28 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: JOB_TIMELINE.completeSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <CheckCircle2 size={36} color={Colors.accent} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              fontSize: 26,
              lineHeight: 32,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              letterSpacing: -0.5,
              textAlign: 'center',
            }}
          >
            Booking confirmed
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 22,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            We&apos;ll notify you when providers respond.
          </Text>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 20, gap: 14 }}>
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textPrimary }}>
            {displayService}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {displayDate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CalendarDays size={16} color={Colors.accent} />
                <Text style={{ marginLeft: 8, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark, fontSize: 14 }}>
                  {displayDate}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock3 size={16} color={Colors.accent} />
              <Text style={{ marginLeft: 8, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark, fontSize: 14 }}>
                {providerSummary}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={{ fontFamily: 'Poppins-Bold', color: Colors.textPrimary, fontSize: 17, marginBottom: 4 }}>
            What happens next
          </Text>
          <Text style={{ fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, fontSize: 14, marginBottom: 20 }}>
            You can track everything from job details.
          </Text>

          {progressSteps.map((step, index) => {
            const isLast = index === progressSteps.length - 1;
            const dotColor = stepDotColor(step.status);
            const Icon = stepIcon(index);
            const lineColor = step.status === 'pending' ? JOB_TIMELINE.railMuted : dotColor;

            return (
              <View key={step.id} style={{ flexDirection: 'row', marginBottom: isLast ? 0 : 4 }}>
                <View style={{ alignItems: 'center', width: 32, marginRight: 14 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: step.status === 'pending' ? JOB_TIMELINE.dotInactiveFill : dotColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={15} color={step.status === 'pending' ? JOB_TIMELINE.pendingChipText : '#FFFFFF'} />
                  </View>
                  {!isLast ? (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 28,
                        backgroundColor: lineColor,
                        marginTop: 6,
                        opacity: step.status === 'pending' ? 0.35 : 0.5,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 22 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ flex: 1, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, fontSize: 15 }}>
                      {step.title}
                    </Text>
                    <Text style={{ fontFamily: 'Poppins-Medium', color: Colors.textTertiary, fontSize: 12 }}>
                      {step.statusLabel}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      fontSize: 13,
                      lineHeight: 19,
                      marginTop: 4,
                    }}
                  >
                    {step.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24,
          backgroundColor: Colors.white,
        }}
      >
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={{
            backgroundColor: Colors.black,
            borderRadius: BorderRadius.default,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          <Text style={{ color: Colors.white, fontSize: 15, marginRight: 8, fontFamily: 'Poppins-SemiBold' }}>
            {params.requestId ? 'View job details' : 'Go to jobs'}
          </Text>
          <ArrowRight size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaWrapper>
  );
}
