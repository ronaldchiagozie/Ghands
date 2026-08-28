import Skeleton from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SageHeroPanel } from '@/components/provider/SageHeroPanel';
import { Button } from '@/components/ui/Button';
import Toast from '@/components/Toast';
import { WalletPinInput } from '@/components/WalletPinInput';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, Spacing, useSageHeroPanelMetrics } from '@/lib/designSystem';
import { walletService } from '@/services/api';
import { getErrorMessage, getSpecificErrorMessage } from '@/utils/errorMessages';
import {
  extractWalletTransactionFailureReason,
  isCancelledWalletTransaction,
  mapWalletTransactionStatus,
} from '@/utils/walletTransactions';
import { canPollForSettlement, findSettlementRow } from '@/utils/walletSettlement';
import { navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import { appendPaymentFlowLog } from '@/utils/paymentFlowLog';
import { applyDefaultStatusBar } from '@/utils/statusBar';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CheckCircle, Clock, Lock, RefreshCw, Wallet, X, XCircle } from 'lucide-react-native';
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

/**
 * Reflects the real state of the wallet debit — never advanced on a timer.
 * `verifying` is only entered when the API answers `pending` and we are polling
 * the ledger for settlement; `timedOut` means the poll ran out without a verdict.
 */
type PaymentStep = 'processing' | 'verifying' | 'success' | 'failed' | 'timedOut';

/** Ledger poll cadence while a payment sits in `pending`. */
const SETTLEMENT_POLL_MS = 3000;
const SETTLEMENT_MAX_ATTEMPTS = 10;
/** Time the success tick stays up before handing off to the receipt. */
const SUCCESS_HANDOFF_MS = 900;

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

  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceLoadError, setBalanceLoadError] = useState<string | null>(null);
  /** The API reports this on every wallet read; nothing was using it. */
  const [isPinSet, setIsPinSet] = useState<boolean | null>(null);
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
  /** Message shown by the modal's terminal `failed` / `timedOut` states. */
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null);
  /** Reference of the in-flight payment, so `timedOut` can re-check the same one. */
  const settlementRefRef = useRef<string | null>(null);
  /** Amount the API says it actually debited — the receipt's source of truth. */
  const debitedAmountRef = useRef<number | null>(null);
  /** Set on unmount so in-flight polling stops touching state. */
  const unmountedRef = useRef(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const { amountFontSize } = useSageHeroPanelMetrics();

  const amount = params.amount ? parseFloat(params.amount) : 0;
  const hasEnoughBalance = balance != null && balance >= amount && amount > 0;
  const balanceKnown = balance != null;

  const loadBalance = useCallback(async () => {
    try {
      setIsLoadingBalance(true);
      const wallet = await walletService.getWallet();
      const b = typeof wallet.balance === 'number' ? wallet.balance : parseFloat(String(wallet.balance)) || 0;
      setBalance(b);
      setIsPinSet(Boolean(wallet.isPinSet));
      setBalanceLoadError(null);
    } catch (error) {
      if (__DEV__) console.error('Error loading balance:', error);
      setBalanceLoadError(getErrorMessage(error, 'Could not load wallet balance.'));
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useFocusEffect(
    useCallback(() => {
      applyDefaultStatusBar();
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

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    []
  );

  const handlePayNow = () => {
    setPaymentError(null);
    setSettlementMessage(null);

    /**
     * We already know from the wallet read whether a PIN exists. Asking for four
     * digits the account does not have, waiting on the network, then failing is
     * a worse way to learn it than being told up front.
     */
    if (isPinSet === false) {
      haptics.error();
      showError('You need a wallet PIN before you can pay. Create one now.');
      goToCreateOrChangePin();
      return;
    }

    setPin('');
    setShowPinModal(true);
  };

  const goToReceipt = useCallback(
    (reference: string | undefined) => {
      /**
       * The route param is only what we asked to be charged. When the API reports
       * what it actually debited, that figure is the receipt — a receipt showing
       * the requested amount would quietly misstate a charge that differed.
       */
      const debited = debitedAmountRef.current;
      const receiptAmount = debited != null && debited > 0 ? String(debited) : params.amount;

      router.replace({
        pathname: '/PaymentSuccessfulScreen' as any,
        params: {
          transactionId: reference,
          providerName: params.providerName || 'Service Provider',
          serviceName: params.serviceName || 'Service Request',
          amount: receiptAmount,
          requestId: params.requestId,
        },
      });
    },
    [router, params.providerName, params.serviceName, params.amount, params.requestId]
  );

  /**
   * Polls the wallet ledger until the payment reference settles.
   * Uses `mapWalletTransactionStatus` so this screen reads status exactly the
   * same way Wallet and Activity do.
   */
  const waitForSettlement = useCallback(
    async (reference: string): Promise<'completed' | 'failed' | 'timedOut'> => {
      /**
       * No reference means nothing to match a ledger row against. Report it as
       * unsettled rather than polling — matching on a blank would pick up any
       * row that also lacks one and read it as this payment's verdict.
       */
      if (!canPollForSettlement(reference)) return 'timedOut';

      for (let attempt = 0; attempt < SETTLEMENT_MAX_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, SETTLEMENT_POLL_MS));
        if (unmountedRef.current) return 'timedOut';

        try {
          const { transactions } = await walletService.getTransactions({ limit: 25, offset: 0 });
          const row = findSettlementRow(transactions, reference);
          if (!row) continue;
          if (isCancelledWalletTransaction(row)) return 'failed';

          const status = mapWalletTransactionStatus(row);
          if (status === 'completed') return 'completed';
          if (status === 'failed') {
            setSettlementMessage(
              extractWalletTransactionFailureReason(row) ??
                'The payment did not go through. Your wallet has not been debited.'
            );
            return 'failed';
          }
        } catch {
          // A single failed poll is not a verdict — keep trying until attempts run out.
        }
      }
      return 'timedOut';
    },
    []
  );

  /** Re-checks a payment that was still pending when the poll gave up. */
  const handleRecheckSettlement = useCallback(async () => {
    const reference = settlementRefRef.current;
    if (!canPollForSettlement(reference)) {
      /** No reference came back, so there is nothing to re-check against. */
      setSettlementMessage(
        'We could not get a reference for this payment. Check Wallet › Activity for the transaction before paying again.',
      );
      setPaymentStep('timedOut');
      return;
    }
    setSettlementMessage(null);
    setPaymentStep('verifying');

    const outcome = await waitForSettlement(reference);
    if (unmountedRef.current) return;

    if (outcome === 'completed') {
      setPaymentStep('success');
      haptics.success();
      setTimeout(() => {
        if (!unmountedRef.current) goToReceipt(reference);
      }, SUCCESS_HANDOFF_MS);
      return;
    }
    setPaymentStep(outcome === 'failed' ? 'failed' : 'timedOut');
    haptics.error();
  }, [waitForSettlement, goToReceipt]);

  /** Leaves the modal from a terminal state without pretending the payment succeeded. */
  const handleDismissSettlement = useCallback(() => {
    setShowProcessingModal(false);
    setIsProcessingPayment(false);
    setSettlementMessage(null);
    void loadBalance();
  }, [loadBalance]);

  /** Terminal-state retry: back to the PIN sheet for a fresh attempt. */
  const handleRetryPayment = useCallback(() => {
    setShowProcessingModal(false);
    setIsProcessingPayment(false);
    setSettlementMessage(null);
    setPin('');
    void loadBalance();
    setShowPinModal(true);
  }, [loadBalance]);

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
      void appendPaymentFlowLog({
        event: isLogisticsFee ? 'Job payment: pay logistics fee' : 'Job payment: pay for service',
        detail: `requestId=${requestId} amount=₦${amountNum}`,
        transactionId: String(requestId),
      });
      const response = isLogisticsFee
        ? await walletService.payLogisticsFee({ requestId, amount: amountNum, pin: pinValue })
        : await walletService.payForService({ requestId, amount: amountNum, pin: pinValue });

      settlementRefRef.current = response?.reference ?? null;
      debitedAmountRef.current = response?.amount ?? null;

      /**
       * The client only ever proposes an amount; the server decides. A divergence
       * means the request and the debit disagree, which is worth seeing in the
       * flow log even though the server's figure is the one we honour.
       */
      if (response?.amount != null && response.amount > 0 && response.amount !== amountNum) {
        void appendPaymentFlowLog({
          event: 'Job payment: amount differs from request',
          detail: `requested=₦${amountNum} debited=₦${response.amount}`,
          transactionId: String(requestId),
          reference: response?.reference,
        });
      }

      // A 2xx with an explicit `failed` is a real failure — it used to render as success.
      const reportedStatus = String(response?.status ?? '').toLowerCase();

      void appendPaymentFlowLog({
        event: `Job payment: API responded ${reportedStatus || 'no status'}`,
        detail: `reference=${response?.reference ?? '—'}`,
        transactionId: String(requestId),
        reference: response?.reference,
      });

      if (reportedStatus === 'failed') {
        setIsProcessingPayment(false);
        setSettlementMessage(
          'The payment did not go through. Your wallet has not been debited.'
        );
        setPaymentStep('failed');
        haptics.error();
        void loadBalance();
        return;
      }

      if (reportedStatus === 'pending') {
        setPaymentStep('verifying');
        const outcome = await waitForSettlement(String(response?.reference ?? ''));
        if (unmountedRef.current) return;

        setIsProcessingPayment(false);
        void loadBalance();

        if (outcome === 'completed') {
          setPaymentStep('success');
          haptics.success();
          setTimeout(() => {
            if (!unmountedRef.current) goToReceipt(response?.reference);
          }, SUCCESS_HANDOFF_MS);
          return;
        }

        setPaymentStep(outcome === 'failed' ? 'failed' : 'timedOut');
        haptics.error();
        return;
      }

      // `completed` (or a 2xx with no status field) — the debit is done.
      setIsProcessingPayment(false);
      setPaymentStep('success');
      haptics.success();
      void loadBalance();
      setTimeout(() => {
        if (!unmountedRef.current) goToReceipt(response?.reference);
      }, SUCCESS_HANDOFF_MS);
    } catch (error: any) {
      void appendPaymentFlowLog({
        event: 'Job payment: failed',
        detail: error?.message ?? 'Unknown error',
        transactionId: String(requestId),
      });
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
            ? 'Wallet PIN required. Create one below, then come back to pay, or try again if you already have a PIN.'
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
    if (!showProcessingModal) {
      applyDefaultStatusBar();
    }
  }, [showProcessingModal]);

  useEffect(() => {
    if (!showPinModal) {
      applyDefaultStatusBar();
    }
  }, [showPinModal]);

  const isSettling = paymentStep === 'processing' || paymentStep === 'verifying';

  useEffect(() => {
    if (showProcessingModal && isSettling) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      spin.start();
      return () => spin.stop();
    }
  }, [showProcessingModal, isSettling]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const stepMessages: Record<PaymentStep, { title: string; subtitle: string }> = {
    processing: { title: 'Processing payment', subtitle: 'Keep this screen open while we debit your wallet securely.' },
    verifying: { title: 'Confirming payment', subtitle: 'Waiting for your bank ledger to confirm the debit.' },
    success: { title: 'Payment successful', subtitle: 'Your payment went through.' },
    failed: {
      title: 'Payment failed',
      subtitle: settlementMessage ?? 'The payment did not go through. Your wallet has not been debited.',
    },
    timedOut: {
      title: 'Still confirming',
      subtitle:
        'Your payment is taking longer than usual to confirm. It has not failed — you can check again, or close this and view it in your wallet activity.',
    },
  };
  const stepMessage = stepMessages[paymentStep];

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader
        title="Pay from Wallet"
        onBack={() => {
          haptics.light();
          navigateBack(router, NAV_FALLBACK.clientJobs);
        }}
        backgroundColor={Colors.backgroundLight}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner */}
        {paymentError && (
          <View
            style={{
              backgroundColor: paymentError.isInsufficientBalance ? Colors.errorLight : Colors.warningLight,
              borderLeftWidth: 4,
              borderLeftColor: paymentError.isInsufficientBalance ? Colors.error : Colors.warning,
              borderRadius: BorderRadius.default,
              padding: 16,
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Poppins-Regular', color: Colors.textPrimary }}>
                {paymentError.message}
              </Text>
              <TouchableOpacity
                onPress={() => setPaymentError(null)}
                style={{ padding: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss payment error"
              >
                <X size={18} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            </View>
            {paymentError.isInsufficientBalance && (
              <Button
                title="Top up wallet"
                onPress={goToTopUp}
                variant="primary"
                size="medium"
                fullWidth
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        )}

        {/* Balance & amount hero */}
        <SageHeroPanel style={{ marginTop: 8, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: BorderRadius.full,
                backgroundColor: 'rgba(255, 255, 255, 0.11)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <Wallet size={22} color={Colors.white} strokeWidth={2.2} />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.white,
                  opacity: 0.55,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Wallet balance
              </Text>
              {isLoadingBalance ? (
                <Skeleton width={132} height={16} borderRadius={6} variant="sage" style={{ marginTop: 6 }} />
              ) : balanceLoadError && !balanceKnown ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.white, marginBottom: 4 }}>
                    Could not load balance
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.white, opacity: 0.85, lineHeight: 17 }}>
                    {balanceLoadError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void loadBalance()}
                    activeOpacity={0.85}
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading wallet balance"
                  >
                    <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: Colors.white, textDecorationLine: 'underline' }}>
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ fontSize: 15, fontFamily: 'Poppins-Bold', color: Colors.white, marginTop: 2 }}>
                  ₦{(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Poppins-Medium',
                color: Colors.white,
                opacity: 0.55,
                marginBottom: 4,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Amount to pay
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
              ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {!hasEnoughBalance && balanceKnown && !isLoadingBalance && amount > 0 ? (
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.warningLight,
                }}
              >
                Short ₦{Math.max(0, amount - (balance ?? 0)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            ) : null}
            <View
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: BorderRadius.default,
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.14)',
                gap: 10,
              }}
            >
              {params.providerName ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: 'rgba(255,255,255,0.62)' }}>
                    Provider
                  </Text>
                  <Text
                    style={{ flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Poppins-SemiBold', color: Colors.white }}
                    numberOfLines={1}
                  >
                    {params.providerName}
                  </Text>
                </View>
              ) : null}
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
        </SageHeroPanel>

        {/* Insufficient balance */}
        {!isLoadingBalance && balanceKnown && !hasEnoughBalance && amount > 0 && (
          <View
            style={{
              backgroundColor: Colors.errorLight,
              borderRadius: BorderRadius.default,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.errorBorder,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.errorForeground, marginBottom: 8 }}>
              Insufficient balance
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, fontFamily: 'Poppins-Regular', color: Colors.textPrimary, marginBottom: 16 }}>
              You need ₦{(amount - (balance ?? 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })} more to complete this payment. Top up your wallet to continue.
            </Text>
            <Button
              title="Top up wallet"
              onPress={goToTopUp}
              variant="primary"
              size="medium"
              fullWidth
            />
          </View>
        )}

        {/* Pay Now - only when sufficient balance */}
        {!isLoadingBalance && balanceKnown && hasEnoughBalance && (
          <View style={{ marginTop: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'center',
                marginBottom: Spacing.lg,
                paddingHorizontal: 8,
              }}
            >
              <Lock size={16} color={Colors.textMuted} style={{ marginTop: 2 }} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginLeft: 8,
                  lineHeight: 19,
                  textAlign: 'center',
                }}
              >
                Secure payment. This amount will be deducted from your wallet after you enter your PIN.
              </Text>
            </View>
            <Button
              title={`Pay ₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} now`}
              onPress={handlePayNow}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        )}
      </ScrollView>

      {/* Processing Modal — every state below reflects a real API verdict */}
      <Modal
        visible={showProcessingModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Only escapable once the payment has reached a terminal state.
          if (!isSettling && paymentStep !== 'success') handleDismissSettlement();
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.default, padding: 32, alignItems: 'center', minWidth: 300, borderWidth: 1, borderColor: Colors.border }}>
            {paymentStep === 'success' ? (
              <View style={{ width: 80, height: 80, borderRadius: BorderRadius.full, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle size={48} color={Colors.accent} />
              </View>
            ) : paymentStep === 'failed' ? (
              <View style={{ width: 80, height: 80, borderRadius: BorderRadius.full, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <XCircle size={44} color={Colors.error} />
              </View>
            ) : paymentStep === 'timedOut' ? (
              <View style={{ width: 80, height: 80, borderRadius: BorderRadius.full, backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Clock size={44} color={Colors.warningForeground} />
              </View>
            ) : (
              <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 20 }}>
                <RefreshCw size={64} color={Colors.accent} />
              </Animated.View>
            )}
            <Text style={{ fontSize: 18, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' }}>{stepMessage.title}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center' }}>{stepMessage.subtitle}</Text>

            {paymentStep === 'failed' ? (
              <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
                <Button title="Try again" onPress={handleRetryPayment} variant="primary" size="medium" fullWidth />
                <Button title="Close" onPress={handleDismissSettlement} variant="muted" size="medium" fullWidth />
              </View>
            ) : paymentStep === 'timedOut' ? (
              <View style={{ width: '100%', marginTop: 24, gap: 10 }}>
                <Button title="Check again" onPress={() => void handleRecheckSettlement()} variant="primary" size="medium" fullWidth />
                <Button title="Close" onPress={handleDismissSettlement} variant="muted" size="medium" fullWidth />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* PIN Modal — bottom sheet with stable cells (no layout jump) */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          handleCancelPin();
          applyDefaultStatusBar();
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={handleCancelPin} />
          <View
            style={{
              backgroundColor: Colors.white,
              borderTopLeftRadius: BorderRadius.sageHero,
              borderTopRightRadius: BorderRadius.sageHero,
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
                    borderRadius: BorderRadius.full,
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
