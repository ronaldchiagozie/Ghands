import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { authService } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import React, { useState, useCallback, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View, TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AuthButton } from '../components/AuthButton';
import { InputField } from '../components/InputField';
import { SocialButton } from '../components/SocialButton';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { isValidEmail, getPasswordStrength } from '@/utils/inputFormatting';
import { Colors } from '@/lib/designSystem';
import { setClientAccountType } from '@/utils/clientAccountType';

export default function SignupScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Real-time validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{ strength: 'weak' | 'medium' | 'strong'; message: string; score: number } | null>(null);
  
  // Refs for auto-focus
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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
  const handlePasswordChange = useCallback((text: string) => {
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
  }, [confirmPassword]);

  // Real-time confirm password validation
  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
    
    if (text && text !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  }, [password]);

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
      showError('Please fix the errors above');
      return;
    }

    setIsLoading(true);
    setIsSubmitting(true);
    haptics.light();

    try {
      const signupPayload = {
        email: email.trim().toLowerCase(), // Normalize email to lowercase
        password: password.trim(),
      };

      await authService.userSignup(signupPayload);
      
      await setClientAccountType('individual');
      // CRITICAL: Set role so index.tsx routes correctly (client came from SelectAccountTypeScreen)
      await AsyncStorage.setItem('@ghands:user_role', 'client');
      
      await AsyncStorage.setItem('@ghands:signup_email', email.trim());
      await AsyncStorage.removeItem('@ghands:signup_phone');
      await AsyncStorage.setItem('@ghands:profile_complete', 'false');
      
      haptics.success();
      showSuccess('Signup successful!');
      
      router.replace('/(tabs)/home');
    } catch (error: any) {
      haptics.error();
      
      // Check if it's a network error first
      const isNetworkError = error?.isNetworkError || 
                            error?.message?.includes('Network') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Network request failed');
      
      if (isNetworkError) {
        showError('No internet connection. Please check your connection and reconnect to continue.');
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
      } else if (error.message && error.message !== 'Failed' && error.message !== 'Request failed') {
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

  const handleLogin = () => {
    // Navigate to login screen
    router.push('/LoginScreen');
  };

  const handleGoogleSignup = () => {
    // Handle Google signup
  };

  const handleFacebookSignup = () => {
    // Handle Facebook signup
  };

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
        {/* Title */}
        <Text
          style={{
            fontSize: 32,
            fontFamily: 'Poppins-ExtraBold',
            color: '#000000',
            marginBottom: 32,
            lineHeight: 40,
          }}
        >
          Sign Up
        </Text>

        {/* Email Input */}
        <InputField
          placeholder="Email"
          icon={<Mail size={18} color={'white'}/>}
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
        <View>
          <InputField
            placeholder="Password (min 6 characters)"
            icon={<Lock size={18} color={'white'}/>}
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
            <View style={{ marginTop: -8, marginBottom: 8, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flex: 1, height: 4, backgroundColor: Colors.backgroundGray, borderRadius: 2, overflow: 'hidden' }}>
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
          placeholder="Confirm password"
          icon={<Lock size={18} color={'white'}/>}
          secureTextEntry
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          iconPosition="left"
          error={!!confirmPasswordError}
          errorMessage={confirmPasswordError}
          returnKeyType="done"
          onSubmitEditing={handleSignup}
        />


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

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
          <Text
            style={{
              marginHorizontal: 16,
              fontSize: 16,
              fontFamily: 'Poppins-Medium',
              color: Colors.iconMuted,
            }}
          >
            or
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
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
          onPress={handleGoogleSignup}
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
          onPress={handleFacebookSignup}
        />
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