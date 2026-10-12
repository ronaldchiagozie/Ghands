import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  BorderRadius,
  Colors,
  MIN_TOUCH_TARGET,
  useKeyboardAvoidingOffset,
  useScrollViewKeyboardAssist,
} from '@/lib/designSystem';
import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { AlertCircle } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';
import { serviceRequestService, type ServiceRequest, type DisputeCategory } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { formatCurrencyDisplay } from '@/utils/inputFormatting';
import { formatDateShort } from '@/utils/dateFormatting';

const CATEGORY_OPTIONS: { id: DisputeCategory; label: string }[] = [
  { id: 'payment', label: 'Payment issue' },
  { id: 'service_quality', label: 'Service quality' },
  { id: 'behavior', label: 'Provider behavior' },
  { id: 'other', label: 'Something else' },
];

/** Matches the backend's own floor - see docs/DISPUTE_RESOLUTION_ENDPOINTS.md. */
const MIN_DESCRIPTION_LENGTH = 10;

function jobAmount(request: ServiceRequest | null): number | undefined {
  if (!request) return undefined;
  const raw = request.totalCost ?? request.total_amount ?? request.paymentAmount ?? request.amount;
  const parsed = typeof raw === 'string' ? Number(raw.replace(/[₦,\s]/g, '')) : raw;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

function providerName(request: ServiceRequest | null): string | undefined {
  return (
    request?.selectedProvider?.name || request?.provider?.name || request?.providerName || undefined
  );
}

export default function ReportIssueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = Number(params.requestId);
  const { toast, showError, hideToast } = useToast();
  const keyboardOffset = useKeyboardAvoidingOffset();
  const descriptionSectionY = useRef(0);
  const { scrollRef, scrollBottomPad, scrollFieldIntoView } = useScrollViewKeyboardAssist();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(requestId) || requestId <= 0) {
      setIsLoadingJob(false);
      return;
    }
    serviceRequestService
      .getRequestDetails(requestId)
      .then((data) => {
        if (!cancelled) setRequest(data);
      })
      .catch(() => {
        /* the form still works without the summary card */
      })
      .finally(() => {
        if (!cancelled) setIsLoadingJob(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const handleSubmit = async () => {
    if (!Number.isFinite(requestId) || requestId <= 0) {
      showError('This job could not be identified. Please go back and try again.');
      return;
    }
    if (!category) {
      showError('Please select what the issue is about.');
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      showError(`Please describe the issue in a bit more detail (at least ${MIN_DESCRIPTION_LENGTH} characters).`);
      return;
    }

    try {
      setIsSubmitting(true);
      haptics.light();
      const dispute = await serviceRequestService.raiseDispute(requestId, {
        category,
        description: description.trim(),
      });
      haptics.success();
      router.replace({
        pathname: '/DisputeChatScreen' as any,
        params: { disputeId: String(dispute.id), caseId: dispute.caseId },
      });
    } catch (error: any) {
      haptics.error();
      showError(getSpecificErrorMessage(error, 'raise_dispute'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const amount = jobAmount(request);
  const name = providerName(request);

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScreenHeader title="Report an issue" onBack={() => navigateBack(router, NAV_FALLBACK.clientJobs)} backgroundColor={Colors.white} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: scrollBottomPad,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 20,
              lineHeight: 20,
            }}
          >
            Tell us what went wrong with this job. Our support team will review it and get back to you.
          </Text>

          {/* Job summary - real data only, nothing shown until it loads */}
          {isLoadingJob ? (
            <View
              style={{
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.lg,
                padding: 14,
                marginBottom: 20,
                minHeight: 76,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="small" color={Colors.textSecondaryDark} />
            </View>
          ) : request ? (
            <View
              style={{
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.lg,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  marginBottom: 8,
                }}
                numberOfLines={1}
              >
                {request.jobTitle || request.categoryName}
              </Text>
              {amount != null ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: name ? 6 : 0 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
                    Amount
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
                    {formatCurrencyDisplay(amount)}
                  </Text>
                </View>
              ) : null}
              {name ? (
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
                  {name} · {formatDateShort(request.updatedAt) || 'Recently'}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            What's this about?
          </Text>
          <View style={{ marginBottom: 20 }}>
            {CATEGORY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  haptics.selection();
                  setCategory(option.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  borderWidth: 1,
                  borderColor: category === option.id ? Colors.accent : Colors.border,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: BorderRadius.full,
                    borderWidth: 2,
                    borderColor: category === option.id ? Colors.accent : Colors.border,
                    marginRight: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {category === option.id && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: BorderRadius.full,
                        backgroundColor: Colors.accent,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                    flex: 1,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            onLayout={(event) => {
              descriptionSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Describe the issue in detail
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              onFocus={() => scrollFieldIntoView(descriptionSectionY.current, true)}
              placeholder="Please provide details about the issue..."
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={6}
              maxLength={2000}
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.default,
                padding: 14,
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                borderWidth: 1,
                borderColor: Colors.border,
                minHeight: 120,
                textAlignVertical: 'top',
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: Colors.infoLight,
              borderRadius: BorderRadius.default,
              padding: 14,
              marginTop: 20,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={18} color={Colors.info} style={{ marginRight: 10, marginTop: 2 }} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: Colors.info,
                flex: 1,
                lineHeight: 18,
              }}
            >
              Reporting an issue does not affect your account. Once submitted, you can message our
              support team directly about it here in the app.
            </Text>
          </View>
        </ScrollView>

        {/* Submit button - a flex sibling, not absolute, so the keyboard lifts it */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            backgroundColor: Colors.white,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: BorderRadius.default,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSubmitting ? 0.6 : 1,
              minHeight: MIN_TOUCH_TARGET,
            }}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                }}
              >
                Submit Report
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}
