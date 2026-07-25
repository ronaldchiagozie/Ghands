import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spacing, Colors } from '@/lib/designSystem';
import { passwordResetService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AuthButton } from '../components/AuthButton';
import { InputField } from '../components/InputField';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

export default function PasswordConfirmationScreen() {
  const router = useRouter();
  const { email: emailParam, otp: otpParam } = useLocalSearchParams<{
    email?: string;
    otp?: string;
  }>();
  const email = typeof emailParam === 'string' ? emailParam.trim().toLowerCase() : '';
  const otp = typeof otpParam === 'string' ? otpParam.trim() : '';
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    // Validation
    if (!password.trim()) {
      showError('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (!email || !otp) {
        showError('Session expired. Please start reset again.');
        router.replace('/ResetPassword');
        return;
      }

      await passwordResetService.resetPassword({
        email,
        otp,
        newPassword: password,
        confirmPassword,
      });

      showSuccess('Password reset successfully! Redirecting to login...');

      // Navigate to login screen after a short delay
      setTimeout(() => {
        router.replace('/LoginScreen');
      }, 2000);
    } catch (error) {
      showError(getSpecificErrorMessage(error, 'Failed to reset password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToOtp = () => {
    router.back();
  };

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="" onBack={handleBackToOtp} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
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
          Create New Password
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
          Your new password must be different from your previous password.
        </Text>

        {/* New Password Input */}
        <View style={{ marginBottom: 16 }}>
          <InputField
            placeholder="New password"
            icon={<Lock size={18} color="white" />}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            iconPosition="left"
          />
        </View>

        {/* Confirm Password Input */}
        <View style={{ marginBottom: 32 }}>
          <InputField
            placeholder="Confirm new password"
            icon={<Lock size={18} color="white" />}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            iconPosition="left"
          />
        </View>

        {/* Reset Password Button */}
        <View style={{ marginTop: 8, marginBottom: 24 }}>
          <AuthButton
            title={isLoading ? 'Resetting...' : 'Reset Password'}
            onPress={handleResetPassword}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>

        {/* Back to Login Link */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <TouchableOpacity onPress={() => router.push('/LoginScreen')} activeOpacity={0.7}>
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
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}