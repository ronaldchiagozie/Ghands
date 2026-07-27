import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WalletPinInput } from '@/components/WalletPinInput';
import { BorderRadius, Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { walletService } from '@/services/api';
import { haptics } from '@/hooks/useHaptics';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

export default function CreatePINScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    returnParams?: string;
  }>();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleEnterComplete = (_value: string) => {
    setError(null);
    setIsConfirming(true);
    setConfirmPin('');
  };

  const handleConfirmComplete = (value: string) => {
    if (value === pin) {
      handleSavePin(pin, value).catch((err) => {
        console.error('Error saving PIN:', err);
      });
    } else {
      setError('PIN mismatch');
      haptics.error();
      setConfirmPin('');
    }
  };

  const handlePinChange = (value: string) => {
    setError(null);
    if (isConfirming) {
      setConfirmPin(value);
    } else {
      setPin(value);
    }
  };

  const handleSavePin = async (pinValue: string, confirmPinValue: string) => {
    if (pinValue.length !== 4 || confirmPinValue.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (pinValue !== confirmPinValue) {
      setError('PINs do not match');
      return;
    }

    setIsSavingPin(true);
    setError(null);
    haptics.light();

    try {
      await walletService.setPin({
        pin: pinValue,
        confirmPin: confirmPinValue,
      });

      haptics.success();
      setShowSuccessModal(true);
    } catch (error: any) {
      haptics.error();
      const errorMessage =
        getSpecificErrorMessage(error, 'set_pin') ||
        error?.message ||
        'Failed to save PIN. Please try again.';

      if (
        errorMessage.toLowerCase().includes('already set') ||
        errorMessage.toLowerCase().includes('change pin')
      ) {
        setError('PIN is already set. Please use "Change PIN" from Security settings.');
      } else {
        setError(errorMessage);
        setConfirmPin('');
      }
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    if (params.returnTo && params.returnParams) {
      try {
        const returnParams = JSON.parse(params.returnParams);
        router.replace({
          pathname: params.returnTo as any,
          params: returnParams,
        } as any);
      } catch {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const activePin = isConfirming ? confirmPin : pin;

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Create PIN"
          onBack={() => router.back()}
          backgroundColor={Colors.white}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardOffset}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 20,
              paddingTop: 40,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: BorderRadius.full,
                  backgroundColor: Colors.successLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={40} color={Colors.accent} />
              </View>
            </View>

            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.3,
                lineHeight: 24,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Secure Your Wallet
            </Text>

            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
                marginBottom: 40,
                lineHeight: 20,
              }}
            >
              Create a 4-digit PIN to protect your wallet and transactions.
            </Text>

            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
                marginBottom: 16,
              }}
            >
              {isConfirming ? 'Confirm PIN' : 'Enter PIN'}
            </Text>

            <WalletPinInput
              key={isConfirming ? 'confirm-pin' : 'enter-pin'}
              value={activePin}
              onChange={handlePinChange}
              onComplete={isConfirming ? handleConfirmComplete : handleEnterComplete}
              error={!!error}
              disabled={isSavingPin}
              autoFocus
            />

            {isSavingPin ? (
              <View
                style={{
                  alignItems: 'center',
                  marginTop: 16,
                  marginBottom: 16,
                }}
              >
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    marginTop: 8,
                  }}
                >
                  Saving PIN...
                </Text>
              </View>
            ) : null}

            <View style={{ minHeight: 24, marginTop: 16, marginBottom: 40 }}>
              {error ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.error,
                  }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleSuccessClose}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={1}
            onPress={handleSuccessClose}
          >
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: 20,
                padding: 32,
                alignItems: 'center',
                minWidth: 280,
                marginHorizontal: 40,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: Colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Check size={30} color={Colors.white} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                Your PIN is set
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}
