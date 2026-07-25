import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/lib/designSystem';
import { passwordResetService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function OtpScreen() {
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

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (numericValue.length <= 1) {
      const newOtp = [...otp];
      newOtp[index] = numericValue;
      setOtp(newOtp);
      
      // Auto-focus next input if value is entered
      if (numericValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Handle backspace - move to previous input
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const code = otp.join('');
    
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    
    try {
      if (!email) {
        Alert.alert('Missing email', 'Go back and enter your email again.');
        router.replace('/ResetPassword');
        return;
      }

      await passwordResetService.verifyResetOtp(email, code);
      router.push({
        pathname: '/PasswordConfirmation',
        params: { email, otp: code },
      });
    } catch (error) {
      Alert.alert(
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
      Alert.alert('Missing email', 'Go back and enter your email again.');
      return;
    }
    
    setCanResend(false);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    
    try {
      await passwordResetService.forgotPassword(email);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      Alert.alert(
        'Could not resend',
        getSpecificErrorMessage(error, 'Failed to resend code. Please try again.'),
      );
      setCanResend(true);
    }
  };

  const isCodeComplete = otp.join('').length === 6;

  return (
    <SafeAreaWrapper>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 40,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
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
            fontSize: 32,
            fontFamily: 'Poppins-ExtraBold',
            color: Colors.textPrimary,
            marginBottom: 16,
            lineHeight: 40,
          }}
        >
          Enter Verification Code
        </Text>

        {/* Description */}
        <Text
          style={{
            fontSize: 16,
            fontFamily: 'Poppins-Medium',
            color: Colors.textSecondaryDark,
            marginBottom: 32,
            lineHeight: 24,
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
                keyboardType="numeric"
                maxLength={1}
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
            onPress={handleVerifyCode}
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
    </SafeAreaWrapper>
  );
}