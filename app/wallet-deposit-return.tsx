import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/lib/designSystem';
import { applyDefaultStatusBar } from '@/utils/statusBar';
import {
  getHandledDepositReference,
  getPendingDepositReference,
} from '@/utils/walletDepositSession';
import { logWalletDeposit } from '@/utils/paymentFlowLog';

/**
 * Korapay / deposit deep-link target (expo-linking createURL path).
 * Resume verification on Top Up only while a pending reference exists; otherwise open Wallet.
 */
export default function WalletDepositReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    applyDefaultStatusBar();
    const t = setTimeout(() => {
      void (async () => {
        const [pending, handled] = await Promise.all([
          getPendingDepositReference(),
          getHandledDepositReference(),
        ]);
        if (handled || !pending) {
          void logWalletDeposit('Deep link return — no pending verify', {
            reference: pending ?? handled ?? undefined,
            detail: handled ? 'already handled → Wallet' : 'no pending ref → Wallet',
          });
          router.replace('/WalletScreen' as any);
          return;
        }
        void logWalletDeposit('Deep link return — resume Top Up verify', { reference: pending });
        router.replace('/TopUpScreen' as any);
      })();
    }, 100);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundLight }}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}
