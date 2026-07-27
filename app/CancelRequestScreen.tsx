import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Toast from '@/components/Toast';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors, MIN_TOUCH_TARGET, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { serviceRequestService } from '@/services/api';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

const REASONS = [
  'Service Unavailable',
  'Timing issue',
  'Better match found',
  'Others (Please specify)',
];

export default function CancelRequestScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string }>();
  const { toast, showSuccess, hideToast } = useToast();
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [additionalNote, setAdditionalNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    setSubmitError(null);

    const requestIdRaw = params.requestId;
    const requestId =
      typeof requestIdRaw === 'string' ? parseInt(requestIdRaw, 10) : NaN;
    if (!requestIdRaw || Number.isNaN(requestId)) {
      setSubmitError('Missing request information. Go back and try again from your job.');
      return;
    }

    if (selectedReason === 'Others (Please specify)' && !additionalNote.trim()) {
      setSubmitError('Please specify your reason in the text field.');
      return;
    }

    const reason =
      selectedReason === 'Others (Please specify)'
        ? additionalNote.trim()
        : selectedReason;
    const note =
      selectedReason === 'Others (Please specify)' ? additionalNote.trim() : undefined;

    setIsSubmitting(true);
    try {
      await serviceRequestService.cancelRequest(requestId, { reason, note });
      haptics.success();
      showSuccess('Request cancelled.');
      router.replace({
        pathname: '/(tabs)/jobs',
        params: { initialTab: 'Pending' },
      } as any);
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      setSubmitError(getSpecificErrorMessage(error, 'cancel_request'));
    } finally {
      setIsSubmitting(false);
    }
  }, [additionalNote, isSubmitting, params.requestId, router, selectedReason, showSuccess]);

  return (
    <SafeAreaWrapper>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
            }}
          >
            Why did you cancel?
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 24, color: Colors.textPrimary }}>×</Text>
          </TouchableOpacity>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
            marginBottom: 24,
          }}
        >
          Help us improve by sharing your reason
        </Text>

        {REASONS.map((reason) => {
          const isActive = selectedReason === reason;
          return (
            <TouchableOpacity
              key={reason}
              onPress={() => setSelectedReason(reason)}
              className="flex-row items-center justify-between border rounded-2xl px-4 py-4 mb-3"
              style={{ borderColor: Colors.border }}
              activeOpacity={0.85}
            >
              <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Medium' }}>
                {reason}
              </Text>
              <View
                className="w-6 h-6 rounded-full border-2 items-center justify-center"
                style={{ borderColor: isActive ? Colors.textPrimary : Colors.borderStrong }}
              >
                {isActive && (
                  <View className="w-3 h-3 rounded-full" style={{ backgroundColor: Colors.textPrimary }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {selectedReason === 'Others (Please specify)' && (
          <TextInput
            placeholder="Share more details"
            value={additionalNote}
            onChangeText={setAdditionalNote}
            multiline
            className="border rounded-2xl px-4 py-3 text-sm text-black mb-5"
            placeholderTextColor={Colors.placeholder}
            style={{
              fontFamily: 'Poppins-Regular',
              borderColor: Colors.border,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        )}

        {submitError ? (
          <View
            style={{
              backgroundColor: Colors.errorLight,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 14,
                color: Colors.error,
                lineHeight: 20,
              }}
            >
              {submitError}
            </Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <Button
            title="Submit"
            onPress={handleSubmit}
            variant="secondary"
            size="large"
            fullWidth
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </View>

        <Button
          title="Back"
          onPress={() => router.back()}
          variant="ghost"
          size="large"
          fullWidth
          disabled={isSubmitting}
        />

        <Text className="text-xs text-center mt-4" style={{ fontFamily: 'Poppins-Regular', color: Colors.tabInactive }}>
          Your feedback is anonymous
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
