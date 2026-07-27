import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthButton } from '../components/AuthButton';
import { InputField } from '../components/InputField';
import { Colors, Spacing, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import { passwordResetService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

export default function ResetPasswordScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendResetCode = async () => {
    if (!email.trim()) {
      showError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const normalized = email.trim().toLowerCase();
      await passwordResetService.forgotPassword(normalized);
      showSuccess('Verification code sent to your email.');
      router.push({
        pathname: '/OtpScreen',
        params: { email: normalized },
      });
    } catch (error) {
      showError(getSpecificErrorMessage(error, 'Failed to send reset code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="" onBack={handleBackToLogin} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 24,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
            Reset Password
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
            Enter your email address and we&apos;ll send you a verification code to reset your
            password.
          </Text>

          {/* Email Input */}
          <InputField
            placeholder="Email address"
            textContentType="emailAddress"
            autoComplete="email"
            icon={<Mail size={20} color={'white'} />}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            iconPosition="left"
          />

          {/* Send Code Button */}
          <View style={{ marginTop: 8, marginBottom: 24 }}>
            <AuthButton
              title={isLoading ? 'Sending...' : 'Send Reset Code'}
              onPress={handleSendResetCode}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>

          {/* Back to Login Link */}
          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <TouchableOpacity onPress={handleBackToLogin} activeOpacity={0.7}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textPrimary,
                }}
              >
                Remember your password?{' '}
                <Text
                  style={{
                    fontFamily: 'Poppins-Bold',
                    color: Colors.accent,
                  }}
                >
                  Back to Login
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
