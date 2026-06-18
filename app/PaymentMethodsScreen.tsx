import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import Toast from '@/components/Toast';
import { WalletPinInput } from '@/components/WalletPinInput';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { walletService, type BankAccount } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, CheckCircle, ChevronRight, Lock, Plus, Receipt, RefreshCw, Wallet, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WALLET_METHOD = {
  id: 'wallet',
  type: 'WALLET' as const,
  lastFour: 'wallet',
  expires: '',
  lastUsed: '',
};

type PaymentStep = 'processing' | 'verifying' | 'completing' | 'success';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    amount?: string;
    quotationId?: string;
    providerName?: string;
    serviceName?: string;
    transactionId?: string;
  }>();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  const isCheckout = useMemo(() => {
    const ridRaw = params.requestId;
    const amtRaw = params.amount;
    const ridStr = Array.isArray(ridRaw) ? ridRaw[0] : ridRaw;
    const amtStr = Array.isArray(amtRaw) ? amtRaw[0] : amtRaw;
    const rid = ridStr != null && ridStr !== '' ? Number(ridStr) : NaN;
    const amt = amtStr != null && amtStr !== '' ? parseFloat(String(amtStr)) : NaN;
    return Number.isFinite(rid) && rid > 0 && Number.isFinite(amt) && amt > 0;
  }, [params.requestId, params.amount]);

  const { balance: walletBalanceRaw } = useWalletBalance({
    enabled: isCheckout,
    refreshOnFocus: isCheckout,
  });
  const walletBalance = walletBalanceRaw ?? 0;

  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('processing');
  const [selectedMethod, setSelectedMethod] = useState<typeof WALLET_METHOD | null>(null);
  const [pin, setPin] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  // Persistent payment error state - stays visible until user dismisses or retries
  const [paymentError, setPaymentError] = useState<{
    message: string;
    isInsufficientBalance: boolean;
  } | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);

  const loadBillingData = useCallback(async () => {
    try {
      setIsLoadingBilling(true);
      const banks = await walletService.getBankAccounts();
      setBankAccounts(Array.isArray(banks) ? banks : []);
    } catch {
      setBankAccounts([]);
    } finally {
      setIsLoadingBilling(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isCheckout) {
        loadBillingData();
      }
    }, [isCheckout, loadBillingData])
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
    Alert.alert(
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

  const startWalletCheckoutPayment = () => {
    haptics.selection();
    setSelectedMethod(WALLET_METHOD);
    setPaymentError(null);
    setPin('');
    setShowPinModal(true);
  };

  const handleProcessPayment = async (pinValue: string) => {
    // Validate PIN first - must be exactly 4 digits
    if (!pinValue || pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
      showError('Please enter a valid 4-digit PIN.');
      return;
    }

    const ridRaw = params.requestId;
    const amtRaw = params.amount;
    const ridStr = Array.isArray(ridRaw) ? ridRaw[0] : ridRaw;
    const amtStr = Array.isArray(amtRaw) ? amtRaw[0] : amtRaw;

    if (!ridStr || !amtStr) {
      showError('Missing payment information. Please try again.');
      return;
    }

    const requestId = parseInt(String(ridStr), 10);
    const amount = parseFloat(String(amtStr));

    // Validate requestId and amount are valid numbers
    if (isNaN(requestId) || isNaN(amount) || amount <= 0) {
      showError('Invalid payment information. Please check the amount and try again.');
      return;
    }

    setIsProcessingPayment(true);
    setShowPinModal(false);
    setShowProcessingModal(true);
    setPaymentStep('processing');

    try {

      // Call the payment API
      const response = await walletService.payForService({
        requestId,
        amount,
        pin: pinValue,
      });

      // Payment successful - show success animation
      setTimeout(() => {
        setPaymentStep('verifying');
        haptics.light();
      }, 1500);

      setTimeout(() => {
        setPaymentStep('completing');
        haptics.light();
      }, 3000);

      setTimeout(() => {
        setPaymentStep('success');
        haptics.success();
      }, 4000);

      // Navigate to success screen
      setTimeout(() => {
        setShowProcessingModal(false);
        router.replace({
          pathname: '/PaymentSuccessfulScreen' as any,
          params: {
            transactionId: response.reference,
            providerName: params.providerName || 'Service Provider',
            serviceName: params.serviceName || 'Service Request',
            amount: params.amount,
            requestId: params.requestId,
          },
        });
      }, 5500);
    } catch (error: any) {
      console.error('Error processing payment:', error);
      
      setIsProcessingPayment(false);
      setShowProcessingModal(false);
      setShowPinModal(false);
      setPin('');
      
      const errorMessage = error?.message || error?.details?.data?.error || '';
      const errLower = errorMessage.toLowerCase();
      const isPinError =
        errLower.includes('pin') ||
        errLower.includes('wrong pin') ||
        errLower.includes('invalid pin') ||
        errLower.includes('incorrect pin') ||
        errLower.includes('pin not set') ||
        errLower.includes('no pin');

      if (isPinError) {
        haptics.error();
        setIsProcessingPayment(false);
        setShowProcessingModal(false);
        setPin('');
        setShowPinModal(true);
        const notSet =
          /pin not set|no pin|not been set|set up|create.*pin|must set/i.test(errorMessage);
        showError(
          notSet
            ? 'Wallet PIN required. Create one using the link below, then return here, or try your PIN again.'
            : 'That PIN is incorrect. Try again, or create a new PIN below.'
        );
        return;
      }
      
      // Handle other payment failures - STAY on payment screen, show persistent error
      const errorMsg = getSpecificErrorMessage(error, 'pay_for_service') || errorMessage || 'Payment failed. Please try again.';
      const isInsufficientBalance = errorMessage.toLowerCase().includes('insufficient') || 
                                    errorMessage.toLowerCase().includes('balance') ||
                                    errorMsg.toLowerCase().includes('insufficient') ||
                                    errorMsg.toLowerCase().includes('balance');
      
      haptics.error();
      showError(errorMsg);
      
      // Set persistent error state - stays visible until user dismisses or retries
      setPaymentError({
        message: isInsufficientBalance 
          ? 'Insufficient wallet balance. Please top up your wallet to continue with payment.'
          : errorMsg,
        isInsufficientBalance,
      });
      
      // DO NOT navigate away - user stays on payment screen to:
      // 1. See the error clearly
      // 2. Top up wallet if needed (via banner button)
      // 3. Retry payment after fixing the issue
      // This prevents timeline from showing incorrect states
    }
  };

  const handleCancelPin = () => {
    Keyboard.dismiss();
    setShowPinModal(false);
    setPin('');
    setSelectedMethod(null);
    // Clear payment error when user cancel PIN entry
    setPaymentError(null);
  };

  const goToCreateOrChangePin = () => {
    haptics.light();
    setShowPinModal(false);
    setPin('');
    setSelectedMethod(null);
    router.push({
      pathname: '/CreatePINScreen' as any,
      params: {
        returnTo: '/PaymentMethodsScreen',
        returnParams: JSON.stringify({
          requestId: params.requestId,
          amount: params.amount,
          quotationId: params.quotationId,
          providerName: params.providerName,
          serviceName: params.serviceName,
        }),
      },
    } as any);
  };

  // Lift PIN sheet above keyboard without resizing the whole modal
  useEffect(() => {
    if (!showPinModal) {
      setKeyboardInset(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      setKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
    };
    const onHide = () => setKeyboardInset(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showPinModal]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Spinning animation for loader
  useEffect(() => {
    if (showProcessingModal && paymentStep !== 'success') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    }
  }, [showProcessingModal, paymentStep]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStepMessage = () => {
    switch (paymentStep) {
      case 'processing':
        return { title: 'Processing Payment', subtitle: 'Please wait while we process your payment...' };
      case 'verifying':
        return { title: 'Verifying Payment', subtitle: 'Confirming transaction details...' };
      case 'completing':
        return { title: 'Completing Transaction', subtitle: 'Finalizing your payment...' };
      case 'success':
        return { title: 'Payment Successful!', subtitle: 'Your payment has been processed successfully' };
      default:
        return { title: 'Processing...', subtitle: 'Please wait' };
    }
  };

  const stepMessage = getStepMessage();

  if (!isCheckout) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <View className="flex-row items-center px-4 py-3" style={{ paddingTop: 20 }}>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.back();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text
            className="text-lg font-bold text-black flex-1 text-center"
            style={{ fontFamily: 'Poppins-Bold', letterSpacing: -0.3 }}
          >
            Billing & payment
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {isLoadingBilling ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
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
                  borderRadius: 20,
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
                  borderRadius: 20,
                  backgroundColor: '#F7F8FA',
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

            {bankAccounts.length === 0 ? (
              <View
                style={{
              ...providerListCard,
              alignItems: 'center',
              marginBottom: 16,
                }}
              >
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.sageTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
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
                  style={{ backgroundColor: Colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14 }}
                >
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
                    borderRadius: 18,
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

            <TouchableOpacity
              onPress={() => router.push('/WalletScreen' as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: Colors.white,
                borderRadius: 18,
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

  return (
    <SafeAreaWrapper>
        <ScreenHeader title="Pay with wallet" onBack={() => router.back()} backgroundColor={Colors.white} />
      <ScrollView 
        className="flex-1 px-4" 
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Persistent Payment Error Banner - Professional Design */}
        {paymentError && (
          <View
            style={{
              backgroundColor: paymentError.isInsufficientBalance ? '#FEF2F2' : '#FFF4E6',
              borderLeftWidth: 4,
              borderLeftColor: paymentError.isInsufficientBalance ? Colors.error : Colors.warning,
              borderRadius: BorderRadius.md,
              padding: 16,
              marginTop: 16,
              marginBottom: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 0.76,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: paymentError.isInsufficientBalance ? 12 : 0 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: paymentError.isInsufficientBalance ? Colors.error : Colors.warning,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    <X size={14} color={Colors.white} />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-SemiBold',
                      color: paymentError.isInsufficientBalance ? Colors.error : Colors.warning,
                    }}
                  >
                    Payment Error
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                    lineHeight: 20,
                    marginLeft: 32,
                  }}
                >
                  {paymentError.message}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentError(null)}
                style={{
                  padding: 4,
                  borderRadius: 12,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            </View>
            
            {/* Top Up Wallet Button - Only shown for insufficient balance */}
            {paymentError.isInsufficientBalance && (
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  // Pass return path so user can come back to payment after topping up
                  router.push({
                    pathname: '/TopUpScreen' as any,
                    params: {
                      returnTo: '/PaymentMethodsScreen',
                      returnParams: JSON.stringify({
                        requestId: params.requestId,
                        amount: params.amount,
                        quotationId: params.quotationId,
                        providerName: params.providerName,
                        serviceName: params.serviceName,
                      }),
                    },
                  } as any);
                }}
                style={{
                  marginTop: 12,
                  backgroundColor: Colors.accent,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: Colors.accent,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 0.76,
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.white,
                    letterSpacing: 0.3,
                  }}
                >
                  Top Up Wallet
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondaryDark, lineHeight: 20 }}>
            Pay with your GHands wallet balance. You will confirm with your 4-digit wallet PIN.
          </Text>
        </View>

        <TouchableOpacity
          onPress={startWalletCheckoutPayment}
          activeOpacity={0.85}
          style={{
            backgroundColor: Colors.backgroundGray,
            borderRadius: BorderRadius.xl,
            padding: 20,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: Colors.accent,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#0a0a0a',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Wallet size={24} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 17, color: Colors.textPrimary, marginBottom: 4 }}>
                Wallet
              </Text>
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondaryDark }}>
                Available: ₦
                {walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <ChevronRight size={22} color={Colors.textTertiary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            haptics.light();
            router.push('/TopUpScreen' as any);
          }}
          activeOpacity={0.7}
          className="border-2 border-dashed border-gray-300 rounded-2xl px-4 py-5 flex-row items-center justify-between mb-4"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 items-center justify-center mr-4">
              <Plus size={24} color={Colors.accent} />
            </View>
            <Text className="text-base" style={{ fontFamily: 'Poppins-Medium', color: Colors.textPrimary }}>
              Top up wallet
            </Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>

      {/* Payment Processing Modal */}
      <Modal
        visible={showProcessingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: 20,
              padding: 32,
              alignItems: 'center',
              minWidth: 300,
              maxWidth: '90%',
            }}
          >
            {/* Icon/Animation */}
            {paymentStep === 'success' ? (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: Colors.successLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <CheckCircle size={48} color={Colors.accent} />
              </View>
            ) : (
              <View style={{ marginBottom: 20 }}>
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}
                >
                  <RefreshCw size={64} color={Colors.accent} />
                </Animated.View>
              </View>
            )}

            {/* Title */}
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 6,
                textAlign: 'center',
                letterSpacing: -0.3,
              }}
            >
              {stepMessage.title}
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 20,
              }}
            >
              {stepMessage.subtitle}
            </Text>

            {/* Progress Steps */}
            <View style={{ width: '100%', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                      borderRadius: 16,
                      backgroundColor: ['verifying', 'completing', 'success'].indexOf(paymentStep) >= 0
                        ? Colors.accent
                        : paymentStep === 'processing'
                        ? Colors.warningLight
                        : Colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    {['verifying', 'completing', 'success'].indexOf(paymentStep) >= 0 ? (
                      <CheckCircle size={16} color={Colors.white} />
                    ) : (
                      <Lock size={16} color={paymentStep === 'processing' ? '#D97706' : Colors.textSecondaryDark} />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Poppins-Medium',
                      color: ['verifying', 'completing', 'success'].indexOf(paymentStep) >= 0
                        ? Colors.accent
                        : paymentStep === 'processing'
                        ? '#D97706'
                        : Colors.textSecondaryDark,
                      textAlign: 'center',
                    }}
                  >
                    Processing
                  </Text>
                </View>

                <View style={{ flex: 1, height: 2, backgroundColor: ['verifying', 'completing', 'success'].indexOf(paymentStep) >= 0 ? Colors.accent : Colors.border, marginTop: 16, marginHorizontal: 8 }} />

                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                      borderRadius: 16,
                      backgroundColor: ['completing', 'success'].indexOf(paymentStep) >= 0
                        ? Colors.accent
                        : paymentStep === 'verifying'
                        ? Colors.warningLight
                        : Colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    {['completing', 'success'].indexOf(paymentStep) >= 0 ? (
                      <CheckCircle size={16} color={Colors.white} />
                    ) : (
                      <Lock size={16} color={paymentStep === 'verifying' ? '#D97706' : Colors.textSecondaryDark} />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Poppins-Medium',
                      color: ['completing', 'success'].indexOf(paymentStep) >= 0
                        ? Colors.accent
                        : paymentStep === 'verifying'
                        ? '#D97706'
                        : Colors.textSecondaryDark,
                      textAlign: 'center',
                    }}
                  >
                    Verifying
                  </Text>
                </View>

                <View style={{ flex: 1, height: 2, backgroundColor: ['completing', 'success'].indexOf(paymentStep) >= 0 ? Colors.accent : Colors.border, marginTop: 16, marginHorizontal: 8 }} />

                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                      borderRadius: 16,
                      backgroundColor: paymentStep === 'success'
                        ? Colors.accent
                        : paymentStep === 'completing'
                        ? Colors.warningLight
                        : Colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    {paymentStep === 'success' ? (
                      <CheckCircle size={16} color={Colors.white} />
                    ) : (
                      <Lock size={16} color={paymentStep === 'completing' ? '#D97706' : Colors.textSecondaryDark} />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: 'Poppins-Medium',
                      color: paymentStep === 'success'
                        ? Colors.accent
                        : paymentStep === 'completing'
                        ? '#D97706'
                        : Colors.textSecondaryDark,
                      textAlign: 'center',
                    }}
                  >
                    Completing
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Method Info */}
            {selectedMethod && (
              <View
                style={{
                  width: '100%',
                  backgroundColor: Colors.backgroundGray,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                    marginBottom: 4,
                  }}
                >
                  Payment method
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                  }}
                >
                  {selectedMethod.type === 'WALLET' ? 'Wallet balance' : `Card •••• ${selectedMethod.lastFour}`}
                </Text>
              </View>
            )}
          </View>
        </View>
        </Modal>

        {/* PIN Input Modal */}
        <Modal
          visible={showPinModal}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancelPin}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={handleCancelPin} />
            <View
              style={{
                backgroundColor: Colors.white,
                borderTopLeftRadius: BorderRadius.xl,
                borderTopRightRadius: BorderRadius.xl,
                paddingTop: 24,
                paddingBottom: keyboardInset > 0 ? keyboardInset + 12 : Math.max(insets.bottom, 24),
                paddingHorizontal: 20,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 24,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.textPrimary,
                  }}
                >
                  Enter Wallet PIN
                </Text>
                <TouchableOpacity
                  onPress={handleCancelPin}
                  style={{
                    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <X size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Description */}
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                Enter your 4-digit wallet PIN to confirm payment
              </Text>

              {/* Amount Display */}
              {params.amount && (
                <View
                  style={{
                    backgroundColor: Colors.backgroundGray,
                    borderRadius: BorderRadius.default,
                    padding: 16,
                    marginBottom: 24,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      marginBottom: 4,
                    }}
                  >
                    Payment Amount
                  </Text>
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                    }}
                  >
                    ₦{new Intl.NumberFormat('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(parseFloat(params.amount))}
                  </Text>
                </View>
              )}

              <WalletPinInput
                value={pin}
                onChange={setPin}
                onComplete={handleProcessPayment}
                disabled={isProcessingPayment}
                autoFocus={showPinModal}
              />

              <TouchableOpacity onPress={goToCreateOrChangePin} activeOpacity={0.7} style={{ marginTop: 20, marginBottom: 20, alignSelf: 'center', paddingVertical: 6 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.accent, textDecorationLine: 'underline' }}>
                  Forgot PIN? Create or change wallet PIN
                </Text>
              </TouchableOpacity>

              {/* Processing Indicator */}
              {isProcessingPayment && (
                <View
                  style={{
                    alignItems: 'center',
                    marginTop: 16,
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
                    Processing payment...
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={hideToast}
        />
      </SafeAreaWrapper>
    );
  }

