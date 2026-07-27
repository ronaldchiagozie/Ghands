import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { authService } from '@/services/api';
import { useRouter } from 'expo-router';
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
import Svg, { Path } from 'react-native-svg';
import { AuthButton } from '../components/AuthButton';
import { InputField } from '../components/InputField';
import { SocialButton } from '../components/SocialButton';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { isValidEmail } from '@/utils/inputFormatting';
import useOnboarding from '@/hooks/useOnboarding';

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

      router.replace('/(tabs)/home');
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

  const handleGoogleLogin = () => {
    // Handle Google login
  };

  const handleFacebookLogin = () => {
    // Handle Facebook login
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

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
            <Text
              style={{
                marginHorizontal: 16,
                fontSize: 16,
                fontFamily: 'Poppins-Medium',
                color: '#6B7280',
              }}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
          </View>

          {/* Social Buttons */}
          <SocialButton
            title="Continue with Google"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <Path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <Path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <Path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </Svg>
            }
            onPress={handleGoogleLogin}
          />

          <SocialButton
            title="Continue with Facebook"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  fill="#1877F2"
                />
              </Svg>
            }
            onPress={handleFacebookLogin}
          />
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
