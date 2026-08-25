import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { useErrorSheet } from '@/hooks/useErrorSheet';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { walletService, type BankAccount } from '@/services/api';
import { useFocusEffect, useRouter } from 'expo-router';
import { Building2, ChevronRight, Plus, Receipt, Wallet } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);
  /** The thrown error itself — the sheet needs its status, not just a string. */
  const [billingLoadError, setBillingLoadError] = useState<unknown>(null);

  const loadBillingData = useCallback(async () => {
    try {
      setIsLoadingBilling(true);
      setBillingLoadError(null);
      const banks = await walletService.getBankAccounts();
      setBankAccounts(Array.isArray(banks) ? banks : []);
      setBillingLoadError(null);
    } catch (error) {
      setBillingLoadError(error);
    } finally {
      setIsLoadingBilling(false);
    }
  }, []);

  useErrorSheet({
    error: billingLoadError,
    subject: 'your bank accounts',
    hasContent: bankAccounts.length > 0,
    onRetry: loadBillingData,
  });

  useFocusEffect(
    useCallback(() => {
      loadBillingData();
    }, [loadBillingData])
  );

  const handleSetDefaultBank = async (accountId: number) => {
    try {
      haptics.light();
      await walletService.setDefaultBankAccount(accountId);
      showSuccess('Default account updated');
      await loadBillingData();
    } catch (e: any) {
      showError(e?.message || 'Could not update default account');
    }
  };

  const handleRemoveBank = (account: BankAccount) => {
    showAppAlert(
      'Remove bank account?',
      `${account.bankName} ••••${account.accountNumber.slice(-4)} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await walletService.deleteBankAccount(account.id);
              haptics.success();
              showSuccess('Bank account removed');
              await loadBillingData();
            } catch (e: any) {
              showError(e?.message || 'Could not remove account');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader
        title="Billing & payment"
        onBack={() => {
          haptics.light();
          router.back();
        }}
        backgroundColor={Colors.backgroundLight}
      />

      {isLoadingBilling ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.sageTint,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
          <Text style={{ fontSize: 16, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
            Loading billing
          </Text>
          <Text style={{ marginTop: 6, textAlign: 'center', fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, lineHeight: 19 }}>
            Loading your linked bank accounts.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.push('/WalletScreen' as any)}
            activeOpacity={0.85}
            style={{
              ...providerListCard,
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: BorderRadius.full,
                backgroundColor: Colors.sageTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Wallet size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>
                Wallet & top-up
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 2 }}>
                Balance, add funds, and recent activity
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textSecondaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/ActivityScreen' as any)}
            activeOpacity={0.85}
            style={{
              ...providerListCard,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: BorderRadius.full,
                backgroundColor: Colors.borderLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Receipt size={20} color={Colors.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>
                Transaction history
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 2 }}>
                View all payments and refunds
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textSecondaryDark} />
          </TouchableOpacity>

          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: 12 }}>
            Bank accounts
          </Text>
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondaryDark, marginBottom: 12 }}>
            Used for withdrawals. Service payments use your wallet balance and PIN.
          </Text>

          {billingLoadError && bankAccounts.length === 0 ? (
            // Failed: hold the card's real shape, dimmed and still. ErrorSheet explains it.
            <View
              style={{ ...providerListCard, marginBottom: 16, paddingVertical: 24, opacity: 0.35 }}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={{ width: '55%', height: 16, borderRadius: 8, backgroundColor: Colors.backgroundGray, marginBottom: 10 }} />
              <View style={{ width: '38%', height: 13, borderRadius: 8, backgroundColor: Colors.backgroundGray }} />
            </View>
          ) : bankAccounts.length === 0 ? (
            <View
              style={{
            ...providerListCard,
            alignItems: 'center',
            marginBottom: 16,
              }}
            >
              <View style={{ width: 64, height: 64, borderRadius: BorderRadius.full, backgroundColor: Colors.sageTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Building2 size={30} color={Colors.accent} />
              </View>
              <Text style={{ fontFamily: 'Poppins-Bold', color: Colors.textPrimary, textAlign: 'center', marginBottom: 6, fontSize: 16 }}>
                No bank account linked yet
              </Text>
              <Text style={{ fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center', marginBottom: 16, fontSize: 13, lineHeight: 19 }}>
                Add a bank account when you want to withdraw provider earnings.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/ProviderLinkBankAccountScreen' as any)}
                style={{
                  backgroundColor: Colors.accent,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: BorderRadius.default,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} color={Colors.black} strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.black }}>Link bank account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bankAccounts.map((acc) => (
              <View
                key={acc.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: acc.isDefault ? Colors.accent : 'rgba(17,24,39,0.08)',
                }}
              >
                <Building2 size={22} color={Colors.textSecondaryDark} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>
                    {acc.bankName} ••••{acc.accountNumber.slice(-4)}
                  </Text>
                  <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondaryDark, marginTop: 2 }}>
                    {acc.accountName}
                    {acc.isDefault ? ' · Default' : ''}
                  </Text>
                </View>
                {!acc.isDefault && (
                  <TouchableOpacity onPress={() => handleSetDefaultBank(acc.id)} style={{ marginRight: 8 }}>
                    <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.accent }}>Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemoveBank(acc)}>
                  <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.error }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* {bankAccounts.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/ProviderLinkBankAccountScreen' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                marginBottom: 8,
                paddingVertical: 8,
              }}
            >
              <Plus size={16} color={Colors.accent} strokeWidth={2.5} />
              <Text style={{ marginLeft: 6, fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.accent }}>
                Add or replace bank
              </Text>
            </TouchableOpacity>
          ) : null} */}

          <TouchableOpacity
            onPress={() => router.push('/WalletScreen' as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.default,
              padding: 16,
              marginTop: 8,
              borderWidth: 1,
              borderColor: 'rgba(17,24,39,0.08)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Receipt size={22} color={Colors.accent} style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>Transaction history</Text>
                <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondaryDark }}>
                  View receipts and activity
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}
