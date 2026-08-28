import { useToast } from '@/hooks/useToast';
import { haptics } from '@/hooks/useHaptics';
import { mapApiProfileToUserProfile } from '@/hooks/useProfile';
import { BorderRadius, Colors, Spacing, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { profileService } from '@/services/api';
import { authService } from '@/services/authService';
import { unwrapProfilePayload } from '@/utils/profilePayload';
import { writeProfileCompleteFlag } from '@/utils/profileCompletion';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeAreaWrapper from './SafeAreaWrapper';
import { ScreenHeader } from './ScreenHeader';
import { InputField } from './InputField';
import { Button } from './ui/Button';

export interface ProfileCompletionData {
  fullName: string;
  phoneNumber: string;
  gender: string;
}

interface ProfileCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (data: ProfileCompletionData) => void;
}

export default function ProfileCompletionModal({
  visible,
  onClose,
  onComplete,
}: ProfileCompletionModalProps) {
  const { showError } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Shown inside the modal — toasts are often hidden behind nested modals */
  const [inlineError, setInlineError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const [signupPhone, profileRaw] = await Promise.all([
          AsyncStorage.getItem('@ghands:signup_phone'),
          profileService.getCurrentUserProfile().catch(() => null),
        ]);
        if (cancelled) return;
        const mapped = profileRaw ? mapApiProfileToUserProfile(profileRaw) : null;
        if (mapped?.name && mapped.name.trim().length >= 3) {
          setFullName(mapped.name.trim());
        }
        const phoneDigits =
          mapped?.phone?.replace(/\D/g, '') ||
          signupPhone?.replace(/\D/g, '') ||
          '';
        if (phoneDigits.length >= 10) {
          setPhoneNumber(phoneDigits);
        }
        const genderRaw = String(unwrapProfilePayload(profileRaw).gender ?? '').trim();
        if (genderRaw) {
          const normalized =
            genderRaw.charAt(0).toUpperCase() + genderRaw.slice(1).toLowerCase();
          if (['Male', 'Female', 'Other'].includes(normalized)) {
            setGender(normalized);
          }
        }
      } catch {
        /* optional prefill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const persistProfileToBackend = async (
    name: string,
    trimmedPhone: string,
    genderLower: string,
  ): Promise<void> => {
    const signupEmail = (await AsyncStorage.getItem('@ghands:signup_email'))?.trim() ?? '';
    let email = signupEmail;
    if (!email) {
      try {
        const raw = await profileService.getCurrentUserProfile();
        email = mapApiProfileToUserProfile(raw).email;
      } catch {
        email = '';
      }
    }

    await profileService.completeClientSignup({
      fullName: name,
      phoneNumber: trimmedPhone,
      gender: genderLower,
      email: email || undefined,
    });
  };

  const handleComplete = async () => {
    setInlineError('');
    const name = fullName.trim();
    const trimmedPhone = phoneNumber.replace(/\D/g, '');

    if (!name || !trimmedPhone || !gender) {
      const msg = 'Please fill in full name, phone (digits only), and gender.';
      setInlineError(msg);
      haptics.error();
      showError(msg);
      return;
    }

    if (name.length < 3) {
      const msg = 'Please enter your full name (at least 3 characters).';
      setInlineError(msg);
      haptics.error();
      showError(msg);
      return;
    }

    if (trimmedPhone.length < 10 || trimmedPhone.length > 15) {
      const msg =
        'Enter a valid phone number: at least 10 digits (e.g. 08012345678 or 2348012345678).';
      setInlineError(msg);
      haptics.error();
      showError(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = await authService.getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const genderLower = gender.toLowerCase();
      await persistProfileToBackend(name, trimmedPhone, genderLower);

      await writeProfileCompleteFlag(userId);
      await queryClient.invalidateQueries({ queryKey: ['profile', 'current'] });

      setFullName('');
      setPhoneNumber('');
      setGender('');
      setIsSubmitting(false);
      onClose();

      setTimeout(() => {
        onComplete({
          fullName: name,
          phoneNumber: trimmedPhone,
          gender: genderLower,
        });
      }, 300);
    } catch (error: any) {
      setIsSubmitting(false);
      const msg =
        error?.message ||
        getSpecificErrorMessage(error, 'profile') ||
        'Failed to save your profile. Check your connection and try again.';
      setInlineError(msg);
      haptics.error();
      showError(msg);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <ScreenHeader
        title=""
        backgroundColor={Colors.white}
        rightElement={
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.skipButton}
          >
            <Text style={[styles.skipText, isSubmitting && { opacity: 0.4 }]}>Skip for now</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.iconContainer}>
          <User size={26} color={Colors.accent} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title - Shown only for first-time users who haven't completed profile */}
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add your full name, phone, and gender to continue.
          </Text>

          {inlineError ? (
            <View style={styles.inlineErrorBanner}>
              <Text style={styles.inlineErrorText}>{inlineError}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full name</Text>
              <InputField
                placeholder="Enter your full name"
                icon={<User size={20} color={'white'} />}
                value={fullName}
                onChangeText={(t) => {
                  setFullName(t);
                  if (inlineError) setInlineError('');
                }}
                iconPosition="left"
                autoCapitalize="words"
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone number</Text>
              <Text style={styles.fieldHint}>Use digits only (at least 10), e.g. 08012345678</Text>
              <InputField
                placeholder="08012345678"
                icon={<Phone size={20} color={'white'} />}
                value={phoneNumber}
                onChangeText={(t) => {
                  setPhoneNumber(t.replace(/\D/g, ''));
                  if (inlineError) setInlineError('');
                }}
                iconPosition="left"
                keyboardType="phone-pad"
              />
            </View>

            {/* Gender */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderContainer}>
                {['Male', 'Female', 'Other'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.genderOption,
                      gender.toLowerCase() === option.toLowerCase() && styles.genderOptionActive,
                    ]}
                    onPress={() => {
                      setGender(option);
                      if (inlineError) setInlineError('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        gender.toLowerCase() === option.toLowerCase() && styles.genderTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.actions}>
          <Button
            title="Complete Profile"
            onPress={handleComplete}
            variant="primary"
            size="large"
            fullWidth
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
  },
  skipButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondaryDark,
  },
  /** Left-aligned with the form, like a screen — not centred like a sheet. */
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'left',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    textAlign: 'left',
    marginBottom: Spacing.xl,
    lineHeight: 21,
  },
  inlineErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  inlineErrorText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#B91C1C',
    lineHeight: 18,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    marginBottom: 6,
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '10',
  },
  genderText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
  },
  genderTextActive: {
    color: Colors.accent,
    fontFamily: 'Poppins-SemiBold',
  },
  actions: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
