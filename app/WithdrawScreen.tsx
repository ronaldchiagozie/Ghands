import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SageHeroPanel } from '@/components/provider/SageHeroPanel';
import { Button } from '@/components/ui/Button';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, useSageHeroPanelMetrics, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { providerHomeSectionTitle, providerHomeSurface } from '@/lib/providerSurfaceStyles';
import { openWalletTransactionReceipt } from '@/utils/openWalletTransactionReceipt';
import { walletService, type BankAccount } from '@/services/api';
import { getSpecificErrorMessage, presentServerError } from '@/utils/errorMessages';
import { useFocusEffect, useRouter } from 'expo-router';
import { Building2, ChevronDown, Lock, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const PRESET_AMOUNTS = [5000, 10000, 20000, 50000];

export default function WithdrawScreen() {
  const keyboardOffset = useKeyboardAvoidingOffset();
  const router = useRouter();
  const { showError } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('5000');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const pinRefs = React.useRef<TextInput[]>([]);
  /**
   * Re-entrancy guard for the debit. `isWithdrawing` is state, so two submits in
   * the same tick would both read the stale `false` and fire two withdrawals —
   * and the API client no longer retries this endpoint, so the UI is the only
   * thing standing between a fumbled keystroke and a double transfer.
   */
  const withdrawInFlightRef = React.useRef(false);
  const { amountFontSize } = useSageHeroPanelMetrics();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [wallet, accounts] = await Promise.all([
        walletService.getWallet(),
        walletService.getBankAccounts(),
      ]);
      const b = typeof wallet.balance === 'number' ? wallet.balance : parseFloat(String(wallet.balance)) || 0;
      setBalance(b);
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedAccount) {
        const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
        setSelectedAccount(defaultAcc);
      }
    } catch (err) {
      showError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const amount = parseFloat(customAmount) || selectedAmount;
  const hasEnoughBalance = balance >= amount && amount >= 100;

  const handleWithdraw = () => {
    if (__DEV__) {
      console.log('🔍 [Withdraw] handleWithdraw tapped', {
        balance,
        amount,
        hasEnoughBalance,
        hasBankAccount: !!selectedAccount,
      });
    }
    if (!selectedAccount) {
      showError('Please select a bank account');
      return;
    }
    if (!hasEnoughBalance) {
      showError(amount < 100 ? 'Minimum withdrawal is ₦100' : 'Insufficient balance');
      return;
    }
    setPin(['', '', '', '']);
    setShowPinModal(true);
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (value: string, index: number) => {
    const num = value.replace(/\D/g, '').slice(0, 1);
    const newPin = [...pin];
    newPin[index] = num;
    setPin(newPin);
    if (num && index < 3) pinRefs.current[index + 1]?.focus();
    if (index === 3 && num) submitWithdraw(newPin.join(''));
  };

  const submitWithdraw = async (pinValue: string) => {
    if (withdrawInFlightRef.current) return;
    if (!pinValue || pinValue.length !== 4 || !selectedAccount) {
      if (__DEV__) {
        console.log('❌ [Withdraw] submitWithdraw blocked', {
          hasPin: !!pinValue,
          pinLength: pinValue?.length,
          hasBankAccount: !!selectedAccount,
        });
      }
      return;
    }
    try {
      withdrawInFlightRef.current = true;
      setIsWithdrawing(true);
      setShowPinModal(false);
      if (__DEV__) {
        console.log('🔍 [Withdraw] submitting', {
          bankAccountId: selectedAccount.id,
          amount,
        });
      }
      const result = await walletService.withdraw({
        bankAccountId: selectedAccount.id,
        amount,
        pin: pinValue,
        narration: 'Withdrawal',
      });
      if (__DEV__) {
        console.log('✅ [Withdraw] success', { reference: result.reference, status: result.status });
      }
      haptics.success();
      loadData();
      /**
       * Bank transfers usually come back `pending`, so route on the real status
       * rather than claiming success — the same dispatch Wallet and Activity use
       * when you tap a withdrawal row. Handing the helper `replace` puts the
       * receipt in this screen's place, so back returns to the wallet rather than
       * to a withdrawal form that has already been submitted.
       */
      openWalletTransactionReceipt(
        { push: router.replace },
        {
          id: result.reference,
          reference: result.reference,
          type: 'withdrawal',
          status: result.status,
          amount: result.amount,
          createdAt: new Date().toISOString(),
        },
      );
    } catch (err: any) {
      if (__DEV__) {
        console.log('❌ [Withdraw] error', err);
      }
      const rawMsg: string =
        err?.details?.data?.error ||
        err?.details?.error ||
        err?.details?.message ||
        err?.message ||
        '';
      const lower = rawMsg.toLowerCase();

      /**
       * A wrong PIN is the most common failure here and the only one the user
       * can act on immediately. getSpecificErrorMessage always returns its
       * generic "check your PIN and balance" line, so the server's actual
       * "Invalid PIN" was being swallowed and the sheet closed — leaving the
       * user to start the whole withdrawal again to retry four digits.
       */
      const notSet = /pin not set|no pin|not been set|set up|create.*pin|must set/i.test(rawMsg);
      const isPinError = /pin/i.test(rawMsg);

      if (notSet) {
        showError('Wallet PIN not set. Create one first, then withdraw.');
        setTimeout(() => {
          router.push('/CreatePINScreen' as any);
        }, 800);
      } else if (isPinError) {
        haptics.error();
        setPin(['', '', '', '']);
        setShowPinModal(true);
        setTimeout(() => pinRefs.current[0]?.focus(), 250);
        showError('That PIN is incorrect. Try again.');
      } else {
        /** Real reason when it is useful to the user; our own copy when it is not. */
        showError(
          presentServerError(rawMsg) ||
            getSpecificErrorMessage(err, 'withdraw') ||
            'Withdrawal failed. Please try again.'
        );
      }
    } finally {
      withdrawInFlightRef.current = false;
      setIsWithdrawing(false);
    }
  };

  const linkBankHeaderAction = (
    <TouchableOpacity
      onPress={() => router.push('/ProviderLinkBankAccountScreen' as any)}
      style={{
        minWidth: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Add or replace bank account"
    >
      <Plus size={22} color={Colors.accent} strokeWidth={2.5} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
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
            Loading withdrawal
          </Text>
          <Text style={{ marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
            Checking your wallet balance and linked bank accounts.
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <ScreenHeader
          title=""
          onBack={() => navigateBack(router, '/WalletScreen')}
          backgroundColor={Colors.backgroundLight}
          rightElement={linkBankHeaderAction}
        />
        <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
              marginBottom: 18,
            }}
          >
            <Building2 size={38} color={Colors.accent} />
          </View>
          <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
            No bank account linked
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center', marginBottom: 24 }}>
            Link a verified bank account before withdrawing your earnings.
          </Text>
          <Button
            title="Link bank account"
            onPress={() => router.push('/ProviderLinkBankAccountScreen' as any)}
            variant="primary"
            size="medium"
            icon={<Plus size={18} color={Colors.white} strokeWidth={2.5} />}
            iconPosition="left"
          />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader
        title="Withdraw"
        onBack={() => navigateBack(router, '/WalletScreen')}
        backgroundColor={Colors.backgroundLight}
        rightElement={linkBankHeaderAction}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SageHeroPanel style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.border,
              marginBottom: 4,
            }}
          >
            Available balance
          </Text>
          <Text
            style={{
              fontSize: amountFontSize,
              lineHeight: amountFontSize + 3,
              fontFamily: 'Poppins-Bold',
              color: Colors.white,
              letterSpacing: -0.8,
            }}
          >
            ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </SageHeroPanel>

        <Text style={providerHomeSectionTitle}>Bank account</Text>
        <TouchableOpacity
          onPress={() => setShowAccountModal(true)}
          style={{
            ...providerHomeSurface,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Change bank account"
        >
          <Building2 size={20} color={Colors.textSecondaryDark} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>
              {selectedAccount?.bankName} ••••{selectedAccount?.accountNumber?.slice(-4)}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
              {selectedAccount?.accountName}
            </Text>
          </View>
          <ChevronDown size={20} color={Colors.textSecondaryDark} />
        </TouchableOpacity>

        <Text style={{ ...providerHomeSectionTitle, marginTop: 24 }}>Amount</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {PRESET_AMOUNTS.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => { setSelectedAmount(a); setCustomAmount(String(a)); haptics.light(); }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: BorderRadius.full,
                backgroundColor: selectedAmount === a ? Colors.accent : Colors.white,
                borderWidth: 1,
                borderColor: selectedAmount === a ? Colors.accent : Colors.border,
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedAmount === a }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: selectedAmount === a ? Colors.white : Colors.textPrimary }}>
                ₦{a.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={customAmount}
          onChangeText={(t) => {
            const num = t.replace(/\D/g, '');
            setCustomAmount(num);
            const n = parseInt(num, 10);
            if (!isNaN(n)) setSelectedAmount(n);
          }}
          placeholder="Custom amount"
          placeholderTextColor={Colors.placeholder}
          keyboardType="numeric"
          style={{
            ...providerHomeSurface,
            padding: 16,
            fontSize: 16,
            fontFamily: 'Poppins-Medium',
            color: Colors.textPrimary,
          }}
          accessibilityLabel="Custom withdrawal amount"
        />

        <Button
          title={`Withdraw ₦${(amount || 0).toLocaleString()}`}
          onPress={handleWithdraw}
          variant="primary"
          size="large"
          fullWidth
          disabled={!hasEnoughBalance}
          loading={isWithdrawing}
          style={{ marginTop: 32 }}
        />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Account picker modal */}
      <Modal visible={showAccountModal} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowAccountModal(false)}
        >
          <View
            style={{
              backgroundColor: Colors.white,
              borderTopLeftRadius: BorderRadius.sageHero,
              borderTopRightRadius: BorderRadius.sageHero,
              maxHeight: '70%',
              padding: 20,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 16 }}>Select Account</Text>
            <ScrollView>
              {bankAccounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => { setSelectedAccount(acc); setShowAccountModal(false); }}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold' }}>{acc.bankName}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
                    {acc.accountNumber} • {acc.accountName}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  setShowAccountModal(false);
                  router.push('/ProviderLinkBankAccountScreen' as any);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  marginTop: 4,
                }}
              >
                <Plus size={18} color={Colors.accent} strokeWidth={2.5} />
                <Text style={{ marginLeft: 8, fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>
                  Add or replace bank
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PIN modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.default, padding: 24, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: Colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Lock size={24} color={Colors.accent} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold' }}>Enter PIN</Text>
            </View>
            <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginBottom: 20 }}>
              Enter your 4-digit wallet PIN to confirm
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              {[0, 1, 2, 3].map((i) => (
                <TextInput
                  key={i}
                  ref={(r) => { if (r) pinRefs.current[i] = r; }}
                  value={pin[i]}
                  onChangeText={(v) => handlePinChange(v, i)}
                  onKeyPress={(e) => e.nativeEvent.key === 'Backspace' && !pin[i] && i > 0 && pinRefs.current[i - 1]?.focus()}
                  editable={!isWithdrawing}
                  keyboardType="number-pad"
                  maxLength={1}
                  secureTextEntry
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: pin[i] ? Colors.accent : Colors.border,
                    fontSize: 24,
                    fontFamily: 'Poppins-Bold',
                    textAlign: 'center',
                  }}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowPinModal(false)} style={{ alignSelf: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}
