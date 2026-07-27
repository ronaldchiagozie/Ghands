import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { invalidateWalletBalanceCache } from '@/hooks/useWalletBalance';
import { walletService } from '@/services/api';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { AuthError } from '@/utils/errors';
import {
  getPendingDepositReference,
  markDepositReferenceHandled,
} from '@/utils/walletDepositSession';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

/** Same key as Top Up — optional fallback when `reference` param is omitted. */

type VerifyPhase = 'idle' | 'verifying' | 'pending' | 'error';

export default function BankTransferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; reference?: string }>();
  const amount = params.amount || '85,000';

  const [accountNumber] = useState('2219300511');
  const [accountName] = useState('BAMCHURCH LTD');
  const [paymentMethod] = useState('Transfer');
  const [amountDue] = useState(`₦${amount}`);

  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resolveDepositReference = useCallback(async (): Promise<string | null> => {
    const fromRoute = typeof params.reference === 'string' ? params.reference.trim() : '';
    if (fromRoute) return fromRoute;
    try {
      const stored = await getPendingDepositReference();
      const trimmed = stored?.trim();
      return trimmed || null;
    } catch {
      return null;
    }
  }, [params.reference]);

  const handleIHavePaid = useCallback(async () => {
    if (verifyPhase === 'verifying') return;

    setStatusMessage(null);
    const reference = await resolveDepositReference();
    if (!reference) {
      setVerifyPhase('error');
      setStatusMessage(
        'Missing payment reference. Go back to Top Up to start a deposit, or contact support if you already paid.',
      );
      return;
    }

    setVerifyPhase('verifying');
    try {
      const verification = await walletService.verifyDeposit(reference);

      if (verification.status === 'completed') {
        await markDepositReferenceHandled(reference);
        invalidateWalletBalanceCache();
        setVerifyPhase('idle');
        router.back();
        return;
      }

      if (verification.status === 'pending') {
        setVerifyPhase('pending');
        setStatusMessage(
          'Transfer not confirmed yet. Banks can take a few minutes — tap “Check payment” again shortly.',
        );
        return;
      }

      setVerifyPhase('error');
      setStatusMessage(
        'We could not confirm this payment. Try again or contact support if money left your account.',
      );
    } catch (error: unknown) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      setVerifyPhase('error');
      setStatusMessage(getSpecificErrorMessage(error, 'verify_deposit'));
    }
  }, [resolveDepositReference, router, verifyPhase]);

  const isVerifying = verifyPhase === 'verifying';
  const confirmButtonTitle =
    verifyPhase === 'pending' || verifyPhase === 'error' ? 'Check payment' : 'I have paid';

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="Account details" onBack={() => router.back()} backgroundColor={Colors.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
      >
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Account Number
          </Text>
          <View
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.lg,
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {accountNumber}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Amount Due
          </Text>
          <View
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.lg,
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {amountDue}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Account Name
          </Text>
          <View
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.lg,
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {accountName}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Payment method
          </Text>
          <View
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.lg,
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {paymentMethod}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Lock size={16} color={Colors.textSecondaryDark} />
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginLeft: 8,
            }}
          >
            Secure Payment
          </Text>
        </View>

        {statusMessage ? (
          <View
            style={{
              marginBottom: 16,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: BorderRadius.lg,
              backgroundColor: verifyPhase === 'pending' ? Colors.warningLight : Colors.errorLight,
              borderWidth: 1,
              borderColor: verifyPhase === 'pending' ? Colors.warningForeground : Colors.error,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 14,
                lineHeight: 20,
                color: verifyPhase === 'pending' ? Colors.warningForeground : Colors.error,
              }}
            >
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <Button
          title={confirmButtonTitle}
          onPress={handleIHavePaid}
          variant="secondary"
          size="large"
          fullWidth
          loading={isVerifying}
          disabled={isVerifying}
          style={{
            backgroundColor: Colors.black,
          }}
        />

        {isVerifying ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 8 }}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondaryDark }}>
              Checking with your bank…
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaWrapper>
  );
}
