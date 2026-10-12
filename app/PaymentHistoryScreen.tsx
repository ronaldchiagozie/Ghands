import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/lib/designSystem';

/**
 * Legacy route: the old hub screen is removed. Deep links still pointing here
 * land on billing / payment methods instead.
 */
export default function PaymentHistoryScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/PaymentMethodsScreen' as any);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white }}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}
