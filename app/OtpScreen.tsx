import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Button } from '@/components/ui/Button';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { passwordResetService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';

export default function OtpScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === 'string' ? emailParam.trim().toLowerCase() : '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    // Start resend timer
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Submits as soon as all six boxes are filled so the user does not have to reach
  // past the keyboard for the Verify button.
  const maybeAutoSubmit = (nextOtp: string[]) => {
    if (nextOtp.join('').length !== 6 || isVerifying) return;
    Keyboard.dismiss();
    void handleVerifyCode(nextOtp.join(''));
  };

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, '');

    // A paste or an OS code suggestion arrives as several digits in one box — spread
    // them across the remaining boxes rather than dropping the input.
    if (numericValue.length > 1) {
      const digits = numericValue.slice(0, otp.length - index).split('');
      const newOtp = [...otp];
      digits.forEach((digit, offset) => {
        newOtp[index + offset] = digit;
      });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + digits.length, otp.length - 1)]?.focus();
      maybeAutoSubmit(newOtp);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);

    // Auto-focus next input if value is entered
    if (numericValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    maybeAutoSubmit(newOtp);
  };

  const handleKeyPress = (key: string, index: number) => {
    // Handle backspace - move to previous input
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (codeOverride?: string) => {
    const code = codeOverride ?? otp.join('');

    if (code.length !== 6) {
      showAppAlert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifying(true);

    try {
      if (!email) {
        showAppAlert('Missing email', 'Go back and enter your email again.');
        router.replace('/ResetPassword');
        return;
      }

      await passwordResetService.verifyResetOtp(email, code);
      router.push({
        pathname: '/PasswordConfirmation',
        params: { email, otp: code },
      });
    } catch (error) {
      showAppAlert(
        'Invalid Code',
        getSpecificErrorMessage(error, 'The verification code is incorrect. Please try again.'),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackToReset = () => {
    // Disabled: OTP verification should not allow going back
    // router.back();
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    if (!email) {
      showAppAlert('Missing email', 'Go back and enter your email again.');
      return;
    }

    setCanResend(false);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();

    try {
      await passwordResetService.forgotPassword(email);
      showAppAlert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      showAppAlert(
        'Could not resend',
        getSpecificErrorMessage(error, 'Failed to resend code. Please try again.'),
      );
      setCanResend(true);
    }
  };

  const isCodeComplete = otp.join('').length === 6;

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 40,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Back Button - Disabled during OTP verification */}
          {/* <TouchableOpacity
          onPress={handleBackToReset}
          style={{ marginBottom: 24 }}
          activeOpacity={0.7}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Colors.backgroundGray,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </View>
        </TouchableOpacity>

        {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-ExtraBold',
              color: Colors.textPrimary,
              letterSpacing: -0.3,
              marginBottom: 8,
              lineHeight: 24,
            }}
          >
            Enter Verification Code
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 32,
              lineHeight: 20,
            }}
          >
            We&apos;ve sent a 6-digit verification code to your email address.
          </Text>

          {/* OTP Input */}
          <View className="flex-row justify-between mb-8 px-4">
            {otp.map((digit, index) => (
              <View
                key={index}
                className={`w-12 h-14 rounded-xl border-[0.5px] items-center justify-center ${
                  digit ? 'bg-[#4F6739] border-[#4F6739]' : 'bg-gray-100 border-gray-300'
                }`}
              >
                <TextInput
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  // Must allow the full code: maxLength={1} truncates a pasted code to a
                  // single digit before onChangeText can distribute it across the boxes.
                  maxLength={otp.length}
                  className="text-xl font-bold text-white text-center w-full"
                  style={{
                    fontFamily: 'Poppins-Bold',
                  }}
                  placeholderTextColor={Colors.placeholder}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              </View>
            ))}
          </View>

          {/* Verify Button */}
          <View style={{ marginTop: 16, marginBottom: 32 }}>
            <Button
              title={isVerifying ? 'Verifying...' : 'Verify Code'}
              onPress={() => handleVerifyCode()}
              variant="primary"
              size="large"
              fullWidth
              disabled={!isCodeComplete || isVerifying}
              loading={isVerifying}
            />
          </View>

          {/* Resend Code */}
          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <TouchableOpacity
              onPress={handleResendCode}
              activeOpacity={canResend ? 0.7 : 1}
              disabled={!canResend}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textPrimary,
                }}
              >
                Didn&apos;t receive a code?{' '}
                {canResend ? (
                  <Text
                    style={{
                      fontFamily: 'Poppins-Bold',
                      color: Colors.accent,
                    }}
                  >
                    Resend
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    Resend in {resendTimer}s
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
