import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { authService } from '@/services/api';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { resetStackTo } from '@/utils/navigation';
import { Lock, Mail } from 'lucide-react-native';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthButton } from '../components/AuthButton';
import { InputField } from '../components/InputField';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { isValidEmail } from '@/utils/inputFormatting';
import useOnboarding from '@/hooks/useOnboarding';
import { consumePendingAuthToast } from '@/utils/pendingAuthToast';

export default function LoginScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const { isOnboardingComplete } = useOnboarding();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Real-time validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Refs for auto-focus
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    void (async () => {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('@ghands:user_role', 'client');
    })();
  }, []);

  useEffect(() => {
    const message = consumePendingAuthToast();
    if (message) showError(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time email validation
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (text.trim() && !isValidEmail(text.trim())) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  }, []);

  // Real-time password validation
  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (text.length > 0 && text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  }, []);

  const handleLogin = async () => {
    // Validate all fields
    let hasErrors = false;

    if (!email.trim()) {
      setEmailError('Email is required');
      hasErrors = true;
    } else if (!isValidEmail(email.trim())) {
      setEmailError('Please enter a valid email address');
      hasErrors = true;
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      hasErrors = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasErrors = true;
    }

    if (hasErrors) {
      showError('Fix the highlighted fields');
      return;
    }

    setIsLoading(true);
    haptics.light();

    try {
      const response = await authService.userLogin({
        email: email.trim(),
        password: password.trim(),
      });

      // Token is already saved by authService.userLogin
      // Set role to client for regular user login
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('@ghands:user_role', 'client');

      haptics.success();
      showSuccess('Signed in');

      resetStackTo(router, '/(tabs)/home');
    } catch (error: any) {
      haptics.error();
      const errorMessage = getSpecificErrorMessage(error, 'user_login');
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = () => {
    if (isOnboardingComplete) {
      router.replace('/SignupScreen');
    } else {
      router.replace('/onboarding');
    }
  };

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
          {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-ExtraBold',
              color: Colors.textPrimary,
              letterSpacing: -0.3,
              marginBottom: 24,
              lineHeight: 24,
            }}
          >
            Login
          </Text>

          {/* Email Input */}
          <InputField
            placeholder="Email"
            textContentType="emailAddress"
            autoComplete="email"
            icon={<Mail size={18} color={'white'} />}
            keyboardType="email-address"
            value={email}
            onChangeText={handleEmailChange}
            iconPosition="left"
            autoCapitalize="none"
            error={!!emailError}
            errorMessage={emailError}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            autoFocus={true}
          />

          {/* Password Input */}
          <InputField
            ref={passwordInputRef}
            placeholder="Password"
            textContentType="password"
            autoComplete="password"
            icon={<Lock size={18} color={'white'} />}
            secureTextEntry
            value={password}
            onChangeText={handlePasswordChange}
            iconPosition="left"
            error={!!passwordError}
            errorMessage={passwordError}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Forgot Password Link */}
          <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => router.push('/ResetPassword')} activeOpacity={0.7}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: '#4F6739',
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <View style={{ marginTop: 8, marginBottom: 24 }}>
            <AuthButton
              title="Login"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>

          {/* Signup Link */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={handleSignup} activeOpacity={0.7}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Medium',
                  color: '#000000',
                }}
              >
                Don&apos;t have an account?{' '}
                <Text
                  style={{
                    fontFamily: 'Poppins-Bold',
                    color: '#4F6739',
                  }}
                >
                  Sign Up
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
