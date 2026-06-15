import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Toast from '@/components/Toast';
import { WalletPinInput } from '@/components/WalletPinInput';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { walletService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CheckCircle, Lock, RefreshCw, Wallet, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

type PaymentStep = 'processing' | 'verifying' | 'completing' | 'success';

export default function ConfirmWalletPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    amount?: string;
    quotationId?: string;
    providerName?: string;
    serviceName?: string;
    paymentType?: 'service' | 'logistics_fee';
  }>();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('processing');
  const [pin, setPin] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<{
    message: string;
    isInsufficientBalance: boolean;
  } | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const amount = params.amount ? parseFloat(params.amount) : 0;
  const hasEnoughBalance = balance >= amount && amount > 0;

  const loadBalance = useCallback(async () => {
    try {
      setIsLoadingBalance(true);
      const wallet = await walletService.getWallet();
      const b = typeof wallet.balance === 'number' ? wallet.balance : parseFloat(String(wallet.balance)) || 0;
      setBalance(b);
    } catch (error) {
      if (__DEV__) console.error('Error loading balance:', error);
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [loadBalance])
  );

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

  const handlePayNow = () => {
    setPaymentError(null);
    setPin('');
    setShowPinModal(true);
  };

  const handleProcessPayment = async (pinValue: string) => {
    if (!pinValue || pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
      showError('Please enter a valid 4-digit PIN.');
      return;
    }
    if (!params.requestId || !params.amount) {
      showError('Missing payment information. Please try again.');
      return;
    }
    const requestId = parseInt(params.requestId, 10);
    const amountNum = parseFloat(params.amount);
    if (isNaN(requestId) || isNaN(amountNum) || amountNum <= 0) {
      showError('Invalid payment information.');
      return;
    }

    Keyboard.dismiss();
    setIsProcessingPayment(true);
    setShowPinModal(false);
    setShowProcessingModal(true);
    setPaymentStep('processing');

    try {
      const isLogisticsFee = params.paymentType === 'logistics_fee';
      const response = isLogisticsFee
        ? await walletService.payLogisticsFee({ requestId, amount: amountNum, pin: pinValue })
        : await walletService.payForService({ requestId, amount: amountNum, pin: pinValue });

      setTimeout(() => { setPaymentStep('verifying'); haptics.light(); }, 1500);
      setTimeout(() => { setPaymentStep('completing'); haptics.light(); }, 3000);
      setTimeout(() => { setPaymentStep('success'); haptics.success(); }, 4000);
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
      setShowProcessingModal(false);
      setShowPinModal(false);
      setPin('');

      const errorMessage = error?.message || error?.details?.data?.error || '';
      const isAlreadyPaid = /already paid|already been paid|service request already paid/i.test(errorMessage);

      // Payment was completed (e.g. previous attempt succeeded, UI didn't refresh)
      if (isAlreadyPaid) {
        setShowProcessingModal(false);
        showSuccess('This request has already been paid. Taking you to job details.');
        setTimeout(() => {
          router.replace({
            pathname: '/OngoingJobDetails' as any,
            params: { requestId: params.requestId, tab: 'updates', paymentStatus: 'success' },
          } as any);
        }, 1500);
        return;
      }

      const isPinError = /pin|wrong pin|invalid pin|incorrect pin|unauthorized pin|pin not set|no pin|not set up|create.*pin/i.test(
        errorMessage
      );
      if (isPinError) {
        haptics.error();
        setIsProcessingPayment(false);
        setShowProcessingModal(false);
        setPin('');
        setShowPinModal(true);
        const notSet = /pin not set|no pin|not been set|set up|create.*pin|must set/i.test(errorMessage);
        showError(
          notSet
            ? 'Wallet PIN required. Create one below, then come back to pay—or try again if you already have a PIN.'
            : 'That PIN is incorrect. Try again, or create a new PIN below.'
        );
        return;
      }

      setIsProcessingPayment(false);
      const errorContext = params.paymentType === 'logistics_fee' ? 'pay_logistics_fee' : 'pay_for_service';
      const errorMsg = getSpecificErrorMessage(error, errorContext) || errorMessage || 'Payment failed. Please try again.';
      const isInsufficientBalance = /insufficient|balance/i.test(errorMessage) || /insufficient|balance/i.test(errorMsg);
      haptics.error();
      showError(errorMsg);
      setPaymentError({
        message: isInsufficientBalance
          ? 'Insufficient wallet balance. Please top up your wallet to continue.'
          : errorMsg,
        isInsufficientBalance,
      });
    }
  };

  const handleCancelPin = () => {
    Keyboard.dismiss();
    setShowPinModal(false);
    setPin('');
    setPaymentError(null);
  };

  const goToTopUp = () => {
    haptics.light();
    router.push({
      pathname: '/TopUpScreen' as any,
      params: {
        returnTo: '/ConfirmWalletPaymentScreen',
        returnParams: JSON.stringify({
          requestId: params.requestId,
          amount: params.amount,
          quotationId: params.quotationId,
          providerName: params.providerName,
          serviceName: params.serviceName,
          paymentType: params.paymentType || 'service',
        }),
      },
    } as any);
  };

  const goToCreateOrChangePin = () => {
    haptics.light();
    setShowPinModal(false);
    setPin('');
    router.push({
      pathname: '/CreatePINScreen' as any,
      params: {
        returnTo: '/ConfirmWalletPaymentScreen',
        returnParams: JSON.stringify({
          requestId: params.requestId,
          amount: params.amount,
          quotationId: params.quotationId,
          providerName: params.providerName,
          serviceName: params.serviceName,
          paymentType: params.paymentType || 'service',
        }),
      },
    } as any);
  };

  useEffect(() => {
    if (showProcessingModal && paymentStep !== 'success') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      spin.start();
      return () => spin.stop();
    }
  }, [showProcessingModal, paymentStep]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const stepMessages: Record<PaymentStep, { title: string; subtitle: string }> = {
    processing: { title: 'Processing payment', subtitle: 'Keep this screen open while we debit your wallet securely.' },
    verifying: { title: 'Verifying payment', subtitle: 'Confirming the wallet debit and booking details.' },
    completing: { title: 'Completing transaction', subtitle: 'Finalizing your receipt and job timeline.' },
    success: { title: 'Payment successful', subtitle: 'Your payment has been processed successfully.' },
  };
  const stepMessage = stepMessages[paymentStep];

  return (
    <SafeAreaWrapper>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100" style={{ paddingTop: 20 }}>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            navigateBack(router, NAV_FALLBACK.clientJobs);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-black flex-1 text-center" style={{ fontFamily: 'Poppins-Bold' }}>
          Pay from Wallet
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner */}
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
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textPrimary }}>
                {paymentError.message}
              </Text>
              <TouchableOpacity onPress={() => setPaymentError(null)} style={{ padding: 4 }}>
                <X size={18} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            </View>
            {paymentError.isInsufficientBalance && (
              <TouchableOpacity
                onPress={goToTopUp}
                style={{
                  marginTop: 12,
                  backgroundColor: Colors.accent,
                  paddingVertical: 12,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                  Top Up Wallet
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Balance & amount card */}
        <View
          style={{
            backgroundColor: '#0a0a0a',
            borderRadius: 24,
            padding: 20,
            marginTop: 16,
            marginBottom: 18,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            shadowColor: '#101828',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.16,
            shadowRadius: 18,
            elevation: 0.76,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -52,
              right: -52,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: Colors.accent,
              opacity: 0.14,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: 'rgba(202, 255, 51, 0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(202, 255, 51, 0.28)',
              }}
            >
              <Wallet size={23} color={Colors.accent} />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-SemiBold', color: 'rgba(255,255,255,0.68)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Wallet Balance
              </Text>
              {isLoadingBalance ? (
                <ActivityIndicator size="small" color={Colors.white} style={{ marginTop: 4 }} />
              ) : (
                <Text style={{ fontSize: 20, fontFamily: 'Poppins-Bold', color: Colors.white, marginTop: 2 }}>
                  ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 16 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-SemiBold', color: 'rgba(255,255,255,0.68)', marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Amount to pay
            </Text>
            <Text style={{ fontSize: 32, lineHeight: 40, fontFamily: 'Poppins-Bold', color: Colors.white, letterSpacing: -0.9 }}>
              ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: 'rgba(255,255,255,0.62)' }}>
                  Payment type
                </Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                  {params.paymentType === 'logistics_fee' ? 'Visit fee' : 'Service payment'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: 'rgba(255,255,255,0.62)' }}>
                  For
                </Text>
                <Text
                  style={{ flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Poppins-SemiBold', color: Colors.white }}
                  numberOfLines={1}
                >
                  {params.serviceName || params.providerName || 'Service request'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Insufficient balance */}
        {!isLoadingBalance && !hasEnoughBalance && amount > 0 && (
          <View
            style={{
              backgroundColor: '#FEF2F2',
              borderRadius: BorderRadius.md,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FECACA',
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.error, marginBottom: 8 }}>
              Insufficient balance
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textPrimary, marginBottom: 16 }}>
              You need ₦{(amount - balance).toLocaleString('en-NG', { minimumFractionDigits: 2 })} more to complete this payment. Top up your wallet to continue.
            </Text>
            <TouchableOpacity
              onPress={goToTopUp}
              style={{
                backgroundColor: Colors.accent,
                paddingVertical: 14,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                Top Up Wallet
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pay Now - only when sufficient balance */}
        {!isLoadingBalance && hasEnoughBalance && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Lock size={16} color={Colors.textSecondaryDark} />
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark, marginLeft: 8 }}>
                Secure payment. This amount will be deducted from your wallet.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handlePayNow}
              style={{
                backgroundColor: Colors.black,
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                Pay ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Now
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Processing Modal */}
      <Modal visible={showProcessingModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.default, padding: 32, alignItems: 'center', minWidth: 300, borderWidth: 1, borderColor: Colors.border }}>
            {paymentStep === 'success' ? (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle size={48} color={Colors.accent} />
              </View>
            ) : (
              <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 20 }}>
                <RefreshCw size={64} color={Colors.accent} />
              </Animated.View>
            )}
            <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, marginBottom: 6 }}>{stepMessage.title}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center' }}>{stepMessage.subtitle}</Text>
          </View>
        </View>
      </Modal>

      {/* PIN Modal — bottom sheet with stable cells (no layout jump) */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelPin}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={handleCancelPin} />
          <View
            style={{
              backgroundColor: Colors.white,
              borderTopLeftRadius: BorderRadius.xl,
              borderTopRightRadius: BorderRadius.xl,
              paddingTop: 24,
              paddingHorizontal: 20,
              paddingBottom: keyboardInset > 0 ? keyboardInset + 12 : Math.max(insets.bottom, 24),
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: Colors.successLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Lock size={22} color={Colors.accent} />
                </View>
                <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, flex: 1 }}>
                  Enter Wallet PIN
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelPin}
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginBottom: 20,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Enter your 4-digit wallet PIN to authorize this payment.
            </Text>

            <View
              style={{
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.default,
                padding: 14,
                marginBottom: 22,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginBottom: 4 }}>
                Payment Amount
              </Text>
              <Text style={{ fontSize: 20, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
                ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            <WalletPinInput
              value={pin}
              onChange={setPin}
              onComplete={handleProcessPayment}
              disabled={isProcessingPayment}
              autoFocus={showPinModal}
            />

            <TouchableOpacity
              onPress={goToCreateOrChangePin}
              activeOpacity={0.7}
              style={{ marginTop: 20, marginBottom: 8, alignSelf: 'center', paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.accent, textDecorationLine: 'underline' }}>
                Forgot PIN? Create or change wallet PIN
              </Text>
            </TouchableOpacity>

            {isProcessingPayment ? (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 8 }}>
                  Processing payment...
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}
