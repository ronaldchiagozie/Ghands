import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { recordSignupStep } from '@/utils/signupProgress';
import { haptics } from '@/hooks/useHaptics';
import { authService } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { resetStackTo } from '@/utils/navigation';
import { Gift, Lock, Mail } from 'lucide-react-native';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  InteractionManager,
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
import { isValidEmail, getPasswordStrength } from '@/utils/inputFormatting';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { setClientAccountType } from '@/utils/clientAccountType';

export default function SignupScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const params = useLocalSearchParams<{ referralCode?: string }>();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Prefilled the moment an invite link opens straight into this screen
   * (expo-router forwards its query param here as-is). Nobody else sees the
   * field unless they ask for it - a box asking "got a code?" on every
   * organic signup is a box most people have nothing to put in.
   */
  const referralFromLink = typeof params.referralCode === 'string' ? params.referralCode.trim() : '';
  const [referralCode, setReferralCode] = useState(referralFromLink);
  const [showReferralField, setShowReferralField] = useState(!!referralFromLink);

  // Real-time validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong';
    message: string;
    score: number;
  } | null>(null);

  // Refs for auto-focus
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const referralInputRef = useRef<TextInput>(null);

  // Focusing on mount fires the keyboard mid push-transition, which makes
  // KeyboardAvoidingView's padding jump once the transition settles - wait
  // for the transition to finish so the keyboard opens after the screen has landed.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      emailInputRef.current?.focus();
    });
    return () => task.cancel();
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

  // Real-time password validation with strength indicator
  const handlePasswordChange = useCallback(
    (text: string) => {
      setPassword(text);

      if (text.length > 0 && text.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        setPasswordStrength(null);
      } else if (text.length >= 6) {
        setPasswordError('');
        const strength = getPasswordStrength(text);
        setPasswordStrength(strength);
      } else {
        setPasswordError('');
        setPasswordStrength(null);
      }

      // Check confirm password match if it's already filled
      if (confirmPassword && text !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
      } else if (confirmPassword && text === confirmPassword) {
        setConfirmPasswordError('');
      }
    },
    [confirmPassword],
  );

  // Real-time confirm password validation
  const handleConfirmPasswordChange = useCallback(
    (text: string) => {
      setConfirmPassword(text);

      if (text && text !== password) {
        setConfirmPasswordError('Passwords do not match');
      } else {
        setConfirmPasswordError('');
      }
    },
    [password],
  );

  const handleSignup = async () => {
    // Prevent duplicate submissions
    if (isSubmitting || isLoading) {
      if (__DEV__) {
        console.warn('⚠️ Signup already in progress, ignoring duplicate call');
      }
      return;
    }

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

    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Please confirm your password');
      hasErrors = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasErrors = true;
    }

    if (hasErrors) {
      showError('Fix the highlighted fields');
      return;
    }

    setIsLoading(true);
    setIsSubmitting(true);
    haptics.light();

    try {
      const trimmedReferral = referralCode.trim();
      const signupPayload = {
        email: email.trim().toLowerCase(), // Normalize email to lowercase
        password: password.trim(),
        ...(trimmedReferral ? { referralCode: trimmedReferral } : {}),
      };

      const signupResult = await authService.userSignup(signupPayload);

      await setClientAccountType('individual');
      // CRITICAL: Set role so index.tsx routes correctly (client came from SelectAccountTypeScreen)
      await AsyncStorage.setItem('@ghands:user_role', 'client');

      await AsyncStorage.setItem('@ghands:signup_email', email.trim());
      await AsyncStorage.removeItem('@ghands:signup_phone');
      await AsyncStorage.setItem('@ghands:profile_complete', 'false');
      await recordSignupStep('account_created');

      haptics.success();

      /**
       * Kept as a guard, not an expectation: the backend has since confirmed
       * signup always returns a token, so this should never fire. It stays
       * because the cost of being wrong is asymmetric - without a token the
       * profile step cannot save (its call 401s), and sending someone to sign in
       * is a far better outcome than dropping them into a form that fails on
       * submit with no explanation.
       */
      if (!signupResult?.token) {
        showSuccess('Account created. Please sign in to continue.');
        resetStackTo(router, '/LoginScreen');
        return;
      }

      showSuccess('Account created');
      /** The account exists now - onboarding, the type picker and this form are gone for good. */
      resetStackTo(router, '/ProfileCompletionScreen');
    } catch (error: any) {
      haptics.error();

      // Check if it's a network error first
      const isNetworkError =
        error?.isNetworkError ||
        error?.message?.includes('Network') ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('Network request failed');

      if (isNetworkError) {
        showError(
          'No internet connection. Please check your connection and reconnect to continue.',
        );
        setIsLoading(false);
        setIsSubmitting(false);
        return;
      }

      // Extract error message from API response
      // API returns errors as: { "data": { "error": "..." }, "success": false }
      let errorMessage = 'Signup failed. Please try again.';

      // Check nested data.error first (actual API format)
      if (error.details?.data?.error) {
        errorMessage = error.details.data.error;
      } else if (error.details?.error) {
        errorMessage = error.details.error;
      } else if (
        error.message &&
        error.message !== 'Failed' &&
        error.message !== 'Request failed'
      ) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.details) {
        if (typeof error.details === 'string') {
          errorMessage = error.details;
        } else if (error.details.message) {
          errorMessage = error.details.message;
        }
      }

      // Show the error message from API (already professional)
      showError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    await AsyncStorage.setItem('@ghands:user_role', 'client');
    router.push('/LoginScreen');
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
            Sign Up
          </Text>

          {/* Email Input */}
          <InputField
            ref={emailInputRef}
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
          />

          {/* Password Input */}
          <View>
            <InputField
              ref={passwordInputRef}
              placeholder="Password (min 6 characters)"
              textContentType="newPassword"
              autoComplete="new-password"
              icon={<Lock size={18} color={'white'} />}
              secureTextEntry
              value={password}
              onChangeText={handlePasswordChange}
              iconPosition="left"
              error={!!passwordError}
              errorMessage={passwordError}
              maxLength={50}
              showCharCount={password.length > 0}
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
            />
            {/* Password Strength Indicator */}
            {passwordStrength && password.length >= 6 && (
              <View
                style={{
                  marginTop: -8,
                  marginBottom: 8,
                  paddingHorizontal: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      backgroundColor: Colors.backgroundGray,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${(passwordStrength.score / 6) * 100}%`,
                        height: '100%',
                        backgroundColor:
                          passwordStrength.strength === 'weak'
                            ? Colors.errorBright
                            : passwordStrength.strength === 'medium'
                              ? Colors.warning
                              : '#10B981',
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontFamily: 'Poppins-Medium',
                      color:
                        passwordStrength.strength === 'weak'
                          ? Colors.errorBright
                          : passwordStrength.strength === 'medium'
                            ? Colors.warning
                            : '#10B981',
                    }}
                  >
                    {passwordStrength.message}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Confirm Password Input */}
          <InputField
            ref={confirmPasswordInputRef}
            placeholder="Confirm password"
            textContentType="newPassword"
            autoComplete="new-password"
            icon={<Lock size={18} color={'white'} />}
            secureTextEntry
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            iconPosition="left"
            error={!!confirmPasswordError}
            errorMessage={confirmPasswordError}
            returnKeyType={showReferralField ? 'next' : 'done'}
            onSubmitEditing={() =>
              showReferralField ? referralInputRef.current?.focus() : handleSignup()
            }
          />

          {/* Referral code - hidden until asked for or arrived prefilled via an invite link */}
          {showReferralField ? (
            <InputField
              ref={referralInputRef}
              placeholder="Referral code (optional)"
              autoCapitalize="characters"
              icon={<Gift size={18} color={'white'} />}
              value={referralCode}
              onChangeText={setReferralCode}
              iconPosition="left"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
            />
          ) : (
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                setShowReferralField(true);
                InteractionManager.runAfterInteractions(() => referralInputRef.current?.focus());
              }}
              activeOpacity={0.7}
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.accent }}>
                Have a referral code?
              </Text>
            </TouchableOpacity>
          )}

          {/* Sign Up Button */}
          <View style={{ marginTop: 8, marginBottom: 24 }}>
            <AuthButton
              title="Sign Up"
              onPress={handleSignup}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>

          {/* Login Link */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Medium',
                  color: '#000000',
                }}
              >
                Already have an account?{' '}
                <Text
                  style={{
                    fontFamily: 'Poppins-Bold',
                    color: Colors.accent,
                  }}
                >
                  Login
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
