import { useToast } from '@/hooks/useToast';
import { haptics } from '@/hooks/useHaptics';
import { BorderRadius, Colors, Spacing, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { apiClient } from '@/services/api';
import { authService } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, User, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AnimatedModal from './AnimatedModal';
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
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Shown inside the modal — toasts are often hidden behind nested modals */
  const [inlineError, setInlineError] = useState('');

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

      // Client (booking) user — POST /api/user/complete-signup (not /api/provider/complete-signup)
      try {
        await apiClient.post(`/api/user/complete-signup`, {
          fullName: name,
          phoneNumber: trimmedPhone,
          gender: gender.toLowerCase(),
        });
      } catch (apiError: any) {
        // If API fails, still mark complete locally so user isn't stuck
        if (__DEV__) console.warn('complete-signup API error:', apiError);
      }

      await AsyncStorage.setItem('@ghands:profile_complete', 'true');

      setFullName('');
      setPhoneNumber('');
      setGender('');
      setIsSubmitting(false);
      onClose();

      setTimeout(() => {
        onComplete({
          fullName: name,
          phoneNumber: trimmedPhone,
          gender: gender.toLowerCase(),
        });
      }, 300);
    } catch (error: any) {
      setIsSubmitting(false);
      const msg = error.message || 'Failed to complete profile. Please try again.';
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

  return (
    <AnimatedModal
      visible={visible}
      onClose={handleClose}
      dismissible={!isSubmitting}
      minHeightPercent={92}
      backdropOpacity={0.32}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <User size={24} color={Colors.accent} />
          </View>
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            style={styles.closeButton}
            disabled={isSubmitting}
          >
            <X size={20} color={Colors.textSecondaryDark} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title - Shown only for first-time users who haven't completed profile */}
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Just one more step! Add your full name, phone, and gender to continue.
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
          />
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.backgroundGray,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
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
    gap: Spacing.sm,
  },
  inputContainer: {
    marginBottom: Spacing.sm,
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
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
