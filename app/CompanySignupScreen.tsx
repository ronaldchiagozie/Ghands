import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { authService } from '@/services/api';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { Building2, Lock, Mail, Phone } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
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
import {
  formatPhoneNumber,
  getPasswordStrength,
  isValidEmail,
  isValidPhoneNumber,
} from '@/utils/inputFormatting';

export default function CompanySignupScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong';
    message: string;
    score: number;
  } | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handlePhoneChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    setPhoneNumber(formatPhoneNumber(digits));
    if (digits.length > 0 && digits.length !== 11) {
      setPhoneError('Phone number must be 11 digits');
    } else if (digits.length === 11 && !isValidPhoneNumber(digits)) {
      setPhoneError('Invalid phone number format');
    } else {
      setPhoneError('');
    }
  }, []);

  const handlePasswordChange = useCallback(
    (text: string) => {
      setPassword(text);
      if (text.length > 0 && text.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        setPasswordStrength(null);
      } else if (text.length >= 6) {
        setPasswordError('');
        setPasswordStrength(getPasswordStrength(text));
      } else {
        setPasswordError('');
        setPasswordStrength(null);
      }
      if (confirmPassword && text !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
      } else if (confirmPassword) {
        setConfirmPasswordError('');
      }
    },
    [confirmPassword],
  );

  const handleSignup = async () => {
    let hasErrors = false;
    if (!companyName.trim()) {
      setNameError('Company name is required');
      hasErrors = true;
    } else {
      setNameError('');
    }
    if (!isValidEmail(companyEmail.trim())) {
      setEmailError('Please enter a valid company email');
      hasErrors = true;
    } else {
      setEmailError('');
    }
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (!isValidPhoneNumber(phoneDigits)) {
      setPhoneError('Phone number must be 11 digits');
      hasErrors = true;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasErrors = true;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasErrors = true;
    }
    if (hasErrors) {
      showError('Fix the highlighted fields');
      return;
    }

    setIsLoading(true);
    haptics.light();
    try {
      await authService.clientCompanySignup({
        companyName: companyName.trim(),
        companyEmail: companyEmail.trim(),
        companyPhoneNumber: phoneDigits,
        companyPassword: password.trim(),
      });
      haptics.success();
      showSuccess('Company account created');
      router.replace('/(tabs)/home');
    } catch (error: unknown) {
      haptics.error();
      const err = error as {
        message?: string;
        details?: { data?: { error?: string } };
      };
      showError(
        err.details?.data?.error || err.message || 'Company signup failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
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
            Company sign up
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              lineHeight: 20,
              marginBottom: 28,
            }}
          >
            Business details are saved now. Company accounts don’t need a separate profile step.
          </Text>

          <InputField
            placeholder="Company name"
            textContentType="organizationName"
            autoComplete="organization"
            icon={<Building2 size={18} color="white" />}
            value={companyName}
            onChangeText={(t) => {
              setCompanyName(t);
              if (nameError) setNameError('');
            }}
            iconPosition="left"
            error={!!nameError}
            errorMessage={nameError}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            autoFocus
          />

          <InputField
            ref={emailRef}
            placeholder="Company email"
            textContentType="emailAddress"
            autoComplete="email"
            icon={<Mail size={18} color="white" />}
            keyboardType="email-address"
            value={companyEmail}
            onChangeText={(t) => {
              setCompanyEmail(t);
              if (emailError) setEmailError('');
            }}
            iconPosition="left"
            autoCapitalize="none"
            error={!!emailError}
            errorMessage={emailError}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          <InputField
            ref={phoneRef}
            placeholder="Company phone (11 digits)"
            textContentType="telephoneNumber"
            autoComplete="tel"
            icon={<Phone size={18} color="white" />}
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            iconPosition="left"
            error={!!phoneError}
            errorMessage={phoneError}
            maxLength={13}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <InputField
            ref={passwordRef}
            placeholder="Password (min 6 characters)"
            textContentType="newPassword"
            autoComplete="new-password"
            icon={<Lock size={18} color="white" />}
            secureTextEntry
            value={password}
            onChangeText={handlePasswordChange}
            iconPosition="left"
            error={!!passwordError}
            errorMessage={passwordError}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          {passwordStrength && password.length >= 6 ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Medium',
                color: Colors.accent,
                marginTop: -8,
                marginBottom: 8,
                paddingHorizontal: 16,
              }}
            >
              {passwordStrength.message}
            </Text>
          ) : null}

          <InputField
            ref={confirmRef}
            placeholder="Confirm password"
            textContentType="newPassword"
            autoComplete="new-password"
            icon={<Lock size={18} color="white" />}
            secureTextEntry
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              setConfirmPasswordError(t && t !== password ? 'Passwords do not match' : '');
            }}
            iconPosition="left"
            error={!!confirmPasswordError}
            errorMessage={confirmPasswordError}
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <View style={{ marginTop: 8, marginBottom: 24 }}>
            <AuthButton title="Create company account" onPress={handleSignup} loading={isLoading} />
          </View>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text
              style={{
                textAlign: 'center',
                fontFamily: 'Poppins-Medium',
                color: Colors.accent,
              }}
            >
              Back to account type
            </Text>
          </TouchableOpacity>
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
