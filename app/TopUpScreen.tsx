import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import AnimatedModal from '@/components/AnimatedModal';
import { BorderRadius, Colors, Fonts, Spacing } from '@/lib/designSystem';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ExternalLink, CheckCircle2, XCircle, Wallet } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
  Platform,
  Modal,
  Pressable,
  Keyboard,
  Dimensions,
  KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { Button } from '@/components/ui/Button';
import { walletService, profileService, authService } from '@/services/api';
import { mapApiProfileToUserProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { invalidateWalletBalanceCache } from '@/hooks/useWalletBalance';
import { haptics } from '@/hooks/useHaptics';
import { EMPTY_LABEL } from '@/utils/copy';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { AuthError } from '@/utils/errors';
import Toast from '@/components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyDefaultStatusBar } from '@/utils/statusBar';

const PRESET_AMOUNTS = [5000, 10000, 20000, 50000];
const DEPOSIT_REFERENCE_KEY = '@ghands:pending_deposit_reference';
const TOPUP_RETURN_CTX_KEY = '@ghands:topup_return_context';
const DEPOSIT_POLL_MS = 4000;
const DEPOSIT_MAX_POLL_ATTEMPTS = 15;

export default function TopUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string; // Screen to return to after top-up (e.g., PaymentMethodsScreen)
    returnParams?: string; // JSON string of params to pass back
  }>();
  const { toast, showError, showSuccess, showInfo, hideToast } = useToast();
  const insets = useSafeAreaInsets();
  const emailInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);
  const [emailKeyboardInset, setEmailKeyboardInset] = useState(0);
  const [amountFieldHint, setAmountFieldHint] = useState<string | null>(null);
  
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [pendingDepositReference, setPendingDepositReference] = useState<string | null>(null);
  const [pendingDepositAmount, setPendingDepositAmount] = useState<number | null>(null);
  const [depositVerifyPhase, setDepositVerifyPhase] = useState<'idle' | 'preparing' | 'checkout' | 'checking' | 'processing' | 'failed'>('idle');
  const [paymentModalDismissed, setPaymentModalDismissed] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState<string>('');
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [paymentSessionActive, setPaymentSessionActive] = useState(false);
  const verificationInFlightRef = useRef(false);
  const pollCountRef = useRef(0);
  const depositCompletedRef = useRef(false);

  const releasePaymentUi = useCallback(() => {
    pollCountRef.current = 0;
    verificationInFlightRef.current = false;
    setPendingDepositReference(null);
    setPendingDepositAmount(null);
    setDepositVerifyPhase('idle');
    setPaymentSessionActive(false);
    setPaymentModalDismissed(true);
    setIsVerifyingDeposit(false);
    setIsProcessingCard(false);
    setShowEmailModal(false);
    try {
      void WebBrowser.dismissBrowser();
    } catch {
      /* ignore */
    }
  }, []);

  /** After Kora / browser: stop blocking the screen; keep verifying in background. */
  const unblockUiAfterGatewayReturn = useCallback(() => {
    setIsProcessingCard(false);
    setIsVerifyingDeposit(false);
    verificationInFlightRef.current = false;
    setPaymentModalDismissed(true);
    setDepositVerifyPhase((prev) =>
      prev === 'preparing' || prev === 'checkout' ? 'checking' : prev,
    );
    try {
      void WebBrowser.dismissBrowser();
    } catch {
      /* ignore */
    }
  }, []);

  const showPaymentStatusModal =
    paymentSessionActive &&
    !paymentModalDismissed &&
    depositVerifyPhase !== 'idle';

  const paymentStatusCopy = useMemo(() => {
    switch (depositVerifyPhase) {
      case 'preparing':
        return {
          title: 'Setting up payment',
          subtitle: 'Connecting you to Kora’s secure checkout…',
        };
      case 'checkout':
        return {
          title: 'Proceed to Kora checkout',
          subtitle: 'Complete your payment in the secure window. We’ll update your wallet as soon as you’re done.',
        };
      case 'checking':
        return {
          title: 'Processing your payment',
          subtitle: 'Confirming with Kora and updating your wallet. This only takes a moment.',
        };
      case 'processing':
        return {
          title: 'Processing your payment',
          subtitle: 'Your bank is clearing the payment. We’ll update your balance automatically.',
        };
      case 'failed':
        return {
          title: 'Couldn’t confirm payment',
          subtitle: 'We couldn’t verify this transaction yet. Retry or contact support if you were charged.',
        };
      default:
        return { title: '', subtitle: '' };
    }
  }, [depositVerifyPhase]);

  const isPaymentProcessingPhase =
    depositVerifyPhase === 'checking' || depositVerifyPhase === 'processing';

  const formattedPendingAmount = pendingDepositAmount
    ? `₦${pendingDepositAmount.toLocaleString('en-NG')}`
    : null;

  const resolvedDepositAmount = useMemo(() => {
    const parsed = parseFloat(customAmount);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    return selectedAmount > 0 ? selectedAmount : 0;
  }, [customAmount, selectedAmount]);

  const isDepositAmountValid = resolvedDepositAmount >= 100;

  const formattedDepositAmount = isDepositAmountValid
    ? `₦${resolvedDepositAmount.toLocaleString('en-NG')}`
    : null;

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount(amount.toString());
    setAmountFieldHint(null);
  };

  const promptForAmount = useCallback(() => {
    haptics.light();
    if (!resolvedDepositAmount) {
      setAmountFieldHint('Choose an amount above or enter one below to continue.');
    } else {
      setAmountFieldHint('Minimum top-up is ₦100.');
    }
    amountInputRef.current?.focus();
  }, [resolvedDepositAmount]);

  useEffect(() => {
    if (!showEmailModal) {
      setEmailKeyboardInset(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      setEmailKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
    };
    const onHide = () => setEmailKeyboardInset(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const focusTimer = setTimeout(() => emailInputRef.current?.focus(), 400);
    return () => {
      showSub.remove();
      hideSub.remove();
      clearTimeout(focusTimer);
      setEmailKeyboardInset(0);
    };
  }, [showEmailModal]);

  // Helper function to extract email from JWT token
  const extractEmailFromToken = async (): Promise<string | null> => {
    try {
      const token = await authService.getAuthToken();
      if (!token) return null;
      
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decode the payload (second part)
      const payload = parts[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      // Try common email fields in JWT
      return decoded?.email || decoded?.userEmail || decoded?.user?.email || null;
    } catch (error) {
      return null;
    }
  };

  // Function to load wallet balance
  const loadWalletBalance = useCallback(async () => {
    try {
      const wallet = await walletService.getWallet();
      const balanceValue = typeof wallet.balance === 'number' 
        ? wallet.balance 
        : parseFloat(String(wallet.balance)) || 0;
      
      
      setBalance(balanceValue);
      return balanceValue;
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return 0;
      }
      if (__DEV__) {
        console.error('Error loading wallet balance:', error);
      }
      return 0;
    }
  }, [router]);

  const applySuccessfulDeposit = useCallback(async (verification: { amount: number; balance: number }) => {
    invalidateWalletBalanceCache();
    let freshBalance = 0;
    try {
      freshBalance = await loadWalletBalance();
    } catch {
      freshBalance = 0;
    }
    const verifiedBalance =
      typeof verification.balance === 'number'
        ? verification.balance
        : parseFloat(String(verification.balance)) || 0;
    const nextBalance = Math.max(freshBalance, verifiedBalance);
    setBalance(nextBalance);
    return nextBalance;
  }, [loadWalletBalance]);

  // Load wallet balance and user profile on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load wallet balance
        await loadWalletBalance();
        
        // Try multiple methods to get user email
        let email = '';
        let name = '';
        
        try {
          // Method 1: Try profile API
          const profileRaw = await profileService.getCurrentUserProfile();
          const profile = mapApiProfileToUserProfile(profileRaw);
          email = profile.email || '';
          name = profile.name || '';
        } catch (profileError: any) {
          if (profileError instanceof AuthError) {
            await handleAuthErrorRedirect(router);
            return;
          }
          // Method 2: If profile API fails, try extracting from token
          const tokenEmail = await extractEmailFromToken();
          if (tokenEmail) {
            email = tokenEmail;
          }
        }
        
        // If still no email, try extracting from token as fallback
        if (!email) {
          const tokenEmail = await extractEmailFromToken();
          if (tokenEmail) {
            email = tokenEmail;
          }
        }
        
        setUserEmail(email);
        setUserName(name);
        
        
        // Reconcile any leftover reference from a previous session
        const storedReference = await AsyncStorage.getItem(DEPOSIT_REFERENCE_KEY);
        if (storedReference) {
          setPendingDepositReference(storedReference);
          setPaymentSessionActive(true);
          setDepositVerifyPhase('checking');
          setPaymentModalDismissed(true);
        }
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) console.error('Error loading wallet/profile:', error);
    }
    };
    loadData();
  }, [loadWalletBalance]);

  const cancelPaymentFlow = useCallback(async (options?: { message?: string; showMessage?: boolean }) => {
    if (depositCompletedRef.current) return;
    await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
    releasePaymentUi();
    if (options?.message && options?.showMessage !== false) {
      showInfo(options.message);
    }
  }, [showInfo, releasePaymentUi]);

  // Verify pending deposit (auto-poll + on return from gateway)
  const verifyPendingDeposit = useCallback(async (
    reference: string,
    options: { silent?: boolean; background?: boolean; showFailedUi?: boolean } = {},
  ) => {
    const { silent = false, background = false, showFailedUi = false } = options;
    if (depositCompletedRef.current || verificationInFlightRef.current) return;

    try {
      verificationInFlightRef.current = true;
      if (!background) {
        setIsVerifyingDeposit(true);
      }

      const verification = await Promise.race([
        walletService.verifyDeposit(reference),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Verification timed out')), 28000);
        }),
      ]);

      if (verification.status === 'completed') {
        depositCompletedRef.current = true;
        pollCountRef.current = 0;
        haptics.success();

        await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
        releasePaymentUi();

        const nextBalance = await applySuccessfulDeposit(verification);

        const creditedAmount = verification.amount > 0
          ? verification.amount
          : (pendingDepositAmount ?? 0);
        showSuccess(
          `Successfully topped up ₦${creditedAmount.toLocaleString()}. Your new balance is ₦${nextBalance.toLocaleString()}`,
        );

        let returnTo = params.returnTo;
        let returnParamsRaw: string | undefined = typeof params.returnParams === 'string' ? params.returnParams : undefined;
        if (!returnTo) {
          try {
            const stored = await AsyncStorage.getItem(TOPUP_RETURN_CTX_KEY);
            if (stored) {
              const j = JSON.parse(stored) as { returnTo?: string; returnParams?: string };
              returnTo = j.returnTo;
              returnParamsRaw = j.returnParams ?? '';
            }
          } catch {
            /* ignore */
          }
        }
        if (returnTo) {
          await AsyncStorage.removeItem(TOPUP_RETURN_CTX_KEY);
          setTimeout(() => {
            try {
              const returnParams = returnParamsRaw ? JSON.parse(returnParamsRaw) : {};
              router.replace({
                pathname: returnTo as any,
                params: returnParams,
              } as any);
            } catch {
              router.replace(returnTo as any);
            }
          }, 600);
        }
      } else if (verification.status === 'pending') {
        if (!background) {
          pollCountRef.current += 1;
          if (pollCountRef.current >= DEPOSIT_MAX_POLL_ATTEMPTS) {
            setPaymentModalDismissed(true);
            setIsVerifyingDeposit(false);
            setIsProcessingCard(false);
            verificationInFlightRef.current = false;
            setPaymentSessionActive(false);
            setDepositVerifyPhase('idle');
            showInfo('Still confirming your payment. Pull to refresh your wallet or reopen Top Up.');
            return;
          }
          setDepositVerifyPhase((prev) => (prev === 'checkout' ? 'checking' : 'processing'));
        }
      } else if (verification.status === 'failed') {
        await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
        if (showFailedUi && !background) {
          setDepositVerifyPhase('failed');
          setPaymentSessionActive(true);
          setPaymentModalDismissed(false);
          if (!silent) {
            showError('Payment could not be confirmed. Try again or contact support.');
          }
        } else {
          releasePaymentUi();
        }
      } else {
        if (!background) {
          setDepositVerifyPhase('processing');
        }
      }
    } catch (error: any) {
      const errorText = String(error?.message ?? '').toLowerCase();
      if (errorText.includes('timed out')) {
        verificationInFlightRef.current = false;
        if (!background) {
          setIsVerifyingDeposit(false);
          pollCountRef.current += 1;
        }
        return;
      }
      if (errorText.includes('processing') || errorText.includes('pending')) {
        if (!background) {
          pollCountRef.current += 1;
          if (pollCountRef.current >= DEPOSIT_MAX_POLL_ATTEMPTS) {
            setPaymentModalDismissed(true);
            setIsVerifyingDeposit(false);
            setIsProcessingCard(false);
            verificationInFlightRef.current = false;
            setPaymentSessionActive(false);
            setDepositVerifyPhase('idle');
            showInfo('Still confirming your payment. Pull to refresh your wallet or reopen Top Up.');
            return;
          }
          setDepositVerifyPhase((prev) => (prev === 'checkout' ? 'checking' : 'processing'));
        }
        return;
      }

      const status = error?.status || error?.response?.status;
      if (status === 404) {
        await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
        releasePaymentUi();
        if (!silent && !background && showFailedUi) {
          showError('Payment reference not found. If you have already paid, please contact support.');
        }
        return;
      }

      if (!background && showFailedUi) {
        setDepositVerifyPhase('failed');
        setPaymentSessionActive(true);
        setPaymentModalDismissed(false);
      } else {
        releasePaymentUi();
      }
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('❌ [TopUpScreen] Verification error:', error);
      }
      if (!silent && !background && showFailedUi) {
        const errorMsg = getSpecificErrorMessage(error, 'verify_deposit');
        if (status === 500) {
          showError('Server error during verification. Please try again in a moment.');
        } else {
          showError(errorMsg || 'Failed to verify payment. Please try again or contact support if you have already paid.');
        }
      }
    } finally {
      verificationInFlightRef.current = false;
      if (!background) {
        setIsVerifyingDeposit(false);
      }
    }
  }, [params.returnTo, params.returnParams, router, showSuccess, showError, showInfo, releasePaymentUi, applySuccessfulDeposit, pendingDepositAmount]);

  useFocusEffect(
    useCallback(() => {
      applyDefaultStatusBar();
      invalidateWalletBalanceCache();
      void loadWalletBalance();
      setIsVerifyingDeposit(false);
      setIsProcessingCard(false);
      verificationInFlightRef.current = false;

      void (async () => {
        const storedReference = await AsyncStorage.getItem(DEPOSIT_REFERENCE_KEY);
        if (storedReference && !depositCompletedRef.current) {
          setPendingDepositReference(storedReference);
          setPaymentSessionActive(true);
          setDepositVerifyPhase((prev) =>
            prev === 'idle' || prev === 'failed' || prev === 'checkout' ? 'checking' : prev,
          );
          setPaymentModalDismissed(true);
          void verifyPendingDeposit(storedReference, { silent: true, background: true });
        }
      })();

      return () => {
        setIsVerifyingDeposit(false);
        setIsProcessingCard(false);
        verificationInFlightRef.current = false;
      };
    }, [loadWalletBalance, verifyPendingDeposit]),
  );

  // Auto-poll during an active payment session (continues even if modal is dismissed)
  useEffect(() => {
    if (
      !paymentSessionActive ||
      !pendingDepositReference ||
      depositVerifyPhase === 'failed' ||
      depositVerifyPhase === 'idle' ||
      depositVerifyPhase === 'preparing' ||
      depositVerifyPhase === 'checkout'
    ) {
      return;
    }

    const interval = setInterval(() => {
      void verifyPendingDeposit(pendingDepositReference, { silent: true });
    }, DEPOSIT_POLL_MS);

    return () => clearInterval(interval);
  }, [paymentSessionActive, pendingDepositReference, depositVerifyPhase, verifyPendingDeposit]);

  useEffect(() => {
    if (!pendingDepositReference || depositCompletedRef.current) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || depositCompletedRef.current) return;

      unblockUiAfterGatewayReturn();

      if (pendingDepositReference) {
        void verifyPendingDeposit(pendingDepositReference, { silent: true, background: true });
      }
    });

    return () => subscription.remove();
  }, [pendingDepositReference, verifyPendingDeposit, unblockUiAfterGatewayReturn]);

  useEffect(() => {
    if (
      !paymentSessionActive ||
      !pendingDepositReference ||
      depositVerifyPhase === 'checkout' ||
      depositVerifyPhase === 'failed' ||
      depositVerifyPhase === 'idle'
    ) {
      return;
    }
    const timeout = setTimeout(() => {
      void verifyPendingDeposit(pendingDepositReference, { silent: true });
    }, 400);
    return () => clearTimeout(timeout);
  }, [paymentSessionActive, pendingDepositReference, depositVerifyPhase, verifyPendingDeposit]);

  const hidePaymentModal = useCallback(() => {
    setPaymentModalDismissed(true);
  }, []);

  const handlePaymentModalClose = useCallback(() => {
    hidePaymentModal();
    setIsProcessingCard(false);
    setIsVerifyingDeposit(false);
    verificationInFlightRef.current = false;
  }, [hidePaymentModal]);

  const handleExplicitCancelPayment = useCallback(() => {
    if (depositVerifyPhase === 'checking' || depositVerifyPhase === 'processing') {
      hidePaymentModal();
      setIsProcessingCard(false);
      setIsVerifyingDeposit(false);
      verificationInFlightRef.current = false;
      showInfo('We’ll keep checking in the background. You can leave this screen.');
      return;
    }

    Alert.alert(
      'Cancel payment?',
      'If you already paid in Kora, stay on this screen so we can confirm it.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        {
          text: 'Cancel payment',
          style: 'destructive',
          onPress: () => {
            void cancelPaymentFlow({ message: 'Payment cancelled.' });
          },
        },
      ],
    );
  }, [depositVerifyPhase, hidePaymentModal, cancelPaymentFlow, showInfo]);

  const dismissPaymentModal = useCallback(async () => {
    hidePaymentModal();
    if (depositVerifyPhase === 'failed') {
      await AsyncStorage.removeItem(DEPOSIT_REFERENCE_KEY);
      releasePaymentUi();
    }
  }, [depositVerifyPhase, hidePaymentModal, releasePaymentUi]);

  const retryPaymentVerification = useCallback(() => {
    if (!pendingDepositReference) return;
    setDepositVerifyPhase('checking');
    setPaymentModalDismissed(false);
    setPaymentSessionActive(true);
    void verifyPendingDeposit(pendingDepositReference, { silent: false, showFailedUi: true });
  }, [pendingDepositReference, verifyPendingDeposit]);

  const handleCustomAmountChange = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    setCustomAmount(numericValue);
    if (numericValue && !isNaN(parseFloat(numericValue))) {
      const parsed = parseFloat(numericValue);
      setSelectedAmount(parsed);
      if (parsed >= 100) {
        setAmountFieldHint(null);
      }
    } else {
      setSelectedAmount(0);
    }
  };

  // Open Kora checkout (user picks bank inside Korapay)
  const handleCardPayment = async () => {
    if (!isDepositAmountValid) {
      promptForAmount();
      return;
    }

    const amount = resolvedDepositAmount;

    // Try to get email - use stored email or extract from token
    let emailToUse = userEmail;
    
    if (!emailToUse) {
      // Try extracting from token one more time
      try {
        const tokenEmail = await extractEmailFromToken();
        if (tokenEmail) {
          emailToUse = tokenEmail;
          setUserEmail(tokenEmail);
        }
      } catch (error) {
        // Token extraction failed - will show modal
        if (__DEV__) {
          if (__DEV__) console.log('Token extraction failed');
        }
      }
    }
    
    // If still no email, show email input modal
    if (!emailToUse || !emailToUse.trim() || !emailToUse.includes('@')) {
      setPendingAmount(amount);
      setEmailInput(userEmail || ''); // Pre-fill if we have a partial email
      setShowEmailModal(true);
      return;
    }
    
    // Validate email format before proceeding
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse.trim())) {
      // Invalid email format - show modal to re-enter
      setPendingAmount(amount);
      setEmailInput(emailToUse);
      setShowEmailModal(true);
      return;
    }
    
    // Proceed with payment using available email
    await processCardPayment(emailToUse, amount);
  };

  const handlePayWithKora = handleCardPayment;

  // Separate function to process card payment with email
  const processCardPayment = async (email: string, amount: number) => {
    // Validate email before proceeding
    if (!email || !email.trim() || !email.includes('@')) {
      showError('Please enter a valid email address.');
      setShowEmailModal(true);
      setPendingAmount(amount);
      setEmailInput(email);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address.');
      setShowEmailModal(true);
      setPendingAmount(amount);
      setEmailInput(email);
      return;
    }

    setIsProcessingCard(true);
    haptics.light();
    depositCompletedRef.current = false;

    try {
      const depositCallbackUrl = ExpoLinking.createURL('wallet-deposit-return');

      // Initialize deposit - creates payment link (backend should pass callback into Korapay when supported
      // so the in-app browser can dismiss automatically after paySuccess).
      const depositResponse = await walletService.initializeDeposit({
        amount,
        email: email.trim(),
        name: userName || undefined,
        callbackUrl: depositCallbackUrl,
      });

      haptics.success();

      // Store deposit reference for verification when user returns
      await AsyncStorage.setItem(DEPOSIT_REFERENCE_KEY, depositResponse.reference);
      setPendingDepositReference(depositResponse.reference);
      setPendingDepositAmount(amount);
      setDepositVerifyPhase('checkout');
      setPaymentModalDismissed(false);
      setPaymentSessionActive(true);
      depositCompletedRef.current = false;
      pollCountRef.current = 0;

      if (params.returnTo) {
        await AsyncStorage.setItem(
          TOPUP_RETURN_CTX_KEY,
          JSON.stringify({ returnTo: params.returnTo, returnParams: params.returnParams ?? '' })
        );
      } else {
        await AsyncStorage.removeItem(TOPUP_RETURN_CTX_KEY);
      }

      let usedSystemBrowser = false;

      try {
        WebBrowser.maybeCompleteAuthSession();
        const authResult = await WebBrowser.openAuthSessionAsync(
          depositResponse.authorizationUrl,
          depositCallbackUrl
        );
        applyDefaultStatusBar();
        unblockUiAfterGatewayReturn();

        if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
          pollCountRef.current = 0;
          setDepositVerifyPhase('checking');
          await verifyPendingDeposit(depositResponse.reference, { silent: true, background: true });
          return;
        }

        if (authResult.type === 'success') {
          WebBrowser.maybeCompleteAuthSession();
          pollCountRef.current = 0;
          setDepositVerifyPhase('checking');
          await verifyPendingDeposit(depositResponse.reference, { silent: true, background: true });
          return;
        }

        pollCountRef.current = 0;
        setDepositVerifyPhase('checking');
        await verifyPendingDeposit(depositResponse.reference, { silent: true, background: true });
        return;
      } catch (browserErr) {
        if (__DEV__) {
          console.warn('[TopUp] In-app checkout failed, opening system browser', browserErr);
        }
        const canOpen = await Linking.canOpenURL(depositResponse.authorizationUrl);
        if (canOpen) {
          usedSystemBrowser = true;
          await Linking.openURL(depositResponse.authorizationUrl);
          Alert.alert(
            'Finish in browser',
            Platform.OS === 'ios'
              ? 'After you see Success, return to GHands. Your wallet updates automatically.'
              : 'After you see Success, return to GHands. Your wallet updates automatically.',
            [{ text: 'OK' }]
          );
        } else {
          showError('Unable to open payment gateway. Please try again.');
          await cancelPaymentFlow();
          return;
        }
      } finally {
        setIsProcessingCard(false);
      }

      if (usedSystemBrowser) {
        unblockUiAfterGatewayReturn();
        pollCountRef.current = 0;
        setDepositVerifyPhase('checking');
        await verifyPendingDeposit(depositResponse.reference, { silent: true, background: true });
      }
    } catch (error: any) {
      haptics.error();
      await cancelPaymentFlow();
      if (error instanceof AuthError) {
        showError('Session expired. Signing you in again…');
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('Error initializing deposit:', { error, message: error?.message, status: error?.status });
      }
      const errorMessage = (error?.message || error?.details?.data?.error || error?.details?.error || '').toString();
      const msgLower = errorMessage.toLowerCase();
      let errorMsg = getSpecificErrorMessage(error, 'initialize_deposit');
      if (!errorMsg || errorMsg === 'Failed to initialize payment. Please try again.') {
        if (msgLower.includes('email')) {
          errorMsg = 'Invalid email address. Please check and try again.';
        } else if (msgLower.includes('amount')) {
          errorMsg = 'Invalid amount. Minimum deposit is ₦100.';
        } else if (msgLower.includes('kora') || msgLower.includes('no authorization token') || msgLower.includes('authorization token found')) {
          // Backend called Kora without API key – payment provider not configured on server
          errorMsg = 'Online payments are temporarily unavailable. Please try again later or contact support.';
        } else if (error?.status === 400) {
          errorMsg = 'Invalid payment information. Please check your details and try again.';
        } else if (error?.status === 500) {
          errorMsg = 'Server error. Please try again in a moment.';
        } else {
          errorMsg = errorMessage || 'Failed to initialize payment. Please try again.';
        }
      }
      showError(errorMsg);
      if (errorMessage.toLowerCase().includes('email') || error?.status === 400) {
        setShowEmailModal(true);
        setPendingAmount(amount);
        setEmailInput(email);
      }
    } finally {
      setIsProcessingCard(false);
    }
  };

  const handleTopUpBack = useCallback(() => {
    if (paymentSessionActive && depositVerifyPhase !== 'idle') {
      unblockUiAfterGatewayReturn();
    }
    router.back();
  }, [paymentSessionActive, depositVerifyPhase, unblockUiAfterGatewayReturn, router]);

  const showBackgroundConfirmBanner =
    paymentSessionActive &&
    paymentModalDismissed &&
    (depositVerifyPhase === 'checking' || depositVerifyPhase === 'processing');

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <ScreenHeader title="Top Up" onBack={handleTopUpBack} backgroundColor={Colors.backgroundLight} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
      >
        {showBackgroundConfirmBanner ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: Colors.sageTint,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: Colors.textPrimary,
                lineHeight: 18,
              }}
            >
              Confirming your payment with Kora… You can use the app; balance updates when it clears.
            </Text>
          </View>
        ) : null}
        {/* Current Balance Section */}
        <View
          style={{
            backgroundColor: Colors.backgroundGray,
            borderRadius: 14,
            padding: 18,
            marginBottom: 24,
            position: 'relative',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 6,
            }}
          >
            Current balance
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.3,
              }}
            >
              ₦{balance.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Wallet size={20} color={Colors.textSecondaryDark} />
          </View>
        </View>

        {/* Choose Amount to Add Section */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 17,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 14,
              letterSpacing: -0.2,
            }}
          >
            Choose Amount to Add
          </Text>

          {/* Preset Amount Buttons — 2×2 grid avoids ₦ amount wrapping */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {PRESET_AMOUNTS.map((amount) => {
              const isSelected =
                isDepositAmountValid && resolvedDepositAmount === amount && customAmount === amount.toString();
              return (
                <TouchableOpacity
                  key={amount}
                  onPress={() => handleAmountSelect(amount)}
                  style={{
                    width: '47%',
                    backgroundColor: isSelected ? Colors.accent : Colors.backgroundGray,
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: Colors.border,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-Bold',
                      color: isSelected ? Colors.white : Colors.textPrimary,
                      letterSpacing: -0.2,
                    }}
                  >
                    ₦{amount.toLocaleString('en-NG')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {formattedDepositAmount ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: Colors.sageTint,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                }}
              >
                You&apos;re adding
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.accent,
                }}
              >
                {formattedDepositAmount}
              </Text>
            </View>
          ) : null}

          {/* Custom Amount Input */}
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: amountFieldHint ? '#F59E0B' : Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Medium',
                color: Colors.textMuted,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Or enter amount
            </Text>
            <TextInput
              ref={amountInputRef}
              value={customAmount}
              onChangeText={handleCustomAmountChange}
              placeholder="e.g. 5000"
              keyboardType="decimal-pad"
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                letterSpacing: -0.2,
                minHeight: 28,
              }}
              placeholderTextColor={Colors.placeholder}
            />
          </View>
          {amountFieldHint ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: '#B45309',
                lineHeight: 18,
              }}
            >
              {amountFieldHint}
            </Text>
          ) : (
            <Text
              style={{
                marginTop: 8,
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: Colors.textMuted,
              }}
            >
              Minimum top-up is ₦100.
            </Text>
          )}
        </View>

        {/* Pay — Korapay handles bank selection in checkout */}
        <View style={{ marginBottom: 32, opacity: isDepositAmountValid ? 1 : 0.72 }}>
          <Text
            style={{
              fontSize: 17,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 6,
              letterSpacing: -0.2,
            }}
          >
            Pay
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 16,
              lineHeight: 20,
            }}
          >
            {isDepositAmountValid
              ? `You’ll continue to Kora’s secure checkout to pay ${formattedDepositAmount}. Choose your bank there; no extra steps in the app.`
              : 'Choose an amount above, then tap Pay to open Kora checkout.'}
          </Text>

          <Button
            title={
              isProcessingCard || isVerifyingDeposit
                ? 'Opening checkout…'
                : isDepositAmountValid
                  ? `Pay ${formattedDepositAmount}`
                  : 'Pay'
            }
            onPress={handlePayWithKora}
            variant="primary"
            size="large"
            fullWidth
            disabled={!isDepositAmountValid || isProcessingCard || isVerifyingDeposit}
            loading={isProcessingCard || isVerifyingDeposit}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 14,
              gap: 6,
            }}
          >
            <ExternalLink size={14} color={Colors.textMuted} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: Colors.textMuted,
              }}
            >
              Secured by Kora · bank transfer, USSD, or card in checkout
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Payment status — auto-verifies, no manual check */}
      {showPaymentStatusModal ? (
      <AnimatedModal
        visible
        onClose={handlePaymentModalClose}
        animationType="slide"
        dismissible
        minHeightPercent={depositVerifyPhase === 'failed' ? 44 : 40}
        backdropOpacity={0.55}
      >
        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: Colors.border,
              marginBottom: 28,
            }}
          />

          {depositVerifyPhase === 'failed' ? (
            <>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <XCircle size={32} color="#DC2626" strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  letterSpacing: -0.4,
                  marginBottom: 8,
                }}
              >
                {paymentStatusCopy.title}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  textAlign: 'center',
                  lineHeight: 21,
                  marginBottom: 28,
                  paddingHorizontal: 12,
                }}
              >
                {paymentStatusCopy.subtitle}
              </Text>
              <Button
                title="Try again"
                onPress={retryPaymentVerification}
                variant="primary"
                size="large"
                fullWidth
                style={{ marginBottom: 12 }}
              />
              <TouchableOpacity onPress={() => void dismissPaymentModal()} activeOpacity={0.7}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textMuted,
                    paddingVertical: 8,
                  }}
                >
                  Dismiss
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: Colors.sageTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 22,
                }}
              >
                {depositVerifyPhase === 'checkout' ? (
                  <ExternalLink size={34} color={Colors.accent} strokeWidth={2.2} />
                ) : (
                  <ActivityIndicator size="large" color={Colors.accent} />
                )}
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  letterSpacing: -0.4,
                  marginBottom: 8,
                }}
              >
                {paymentStatusCopy.title}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  textAlign: 'center',
                  lineHeight: 21,
                  marginBottom: formattedPendingAmount ? 16 : 20,
                  paddingHorizontal: 16,
                }}
              >
                {paymentStatusCopy.subtitle}
              </Text>
              {formattedPendingAmount ? (
                <Text
                  style={{
                    fontSize: 28,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.accent,
                    letterSpacing: -0.6,
                    marginBottom: 20,
                  }}
                >
                  {formattedPendingAmount}
                </Text>
              ) : null}
              {depositVerifyPhase === 'checkout' ? (
                <View
                  style={{
                    backgroundColor: Colors.backgroundGray,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginBottom: 8,
                    width: '100%',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                      lineHeight: 19,
                    }}
                  >
                    Pay in the Kora window, then return here. No extra steps needed.
                  </Text>
                </View>
              ) : null}
              {isPaymentProcessingPhase ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  <CheckCircle2 size={14} color={Colors.accent} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textMuted,
                    }}
                  >
                    Confirming with Kora…
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={handleExplicitCancelPayment}
                activeOpacity={0.7}
                style={{ marginTop: 16, paddingVertical: 10 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  {depositVerifyPhase === 'checking' || depositVerifyPhase === 'processing'
                    ? 'Continue in app'
                    : 'Cancel payment'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </AnimatedModal>
      ) : null}

      {/* Email — bottom sheet lifted above keyboard (same pattern as PIN modal) */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEmailModal(false);
          setEmailInput('');
          setPendingAmount(null);
          applyDefaultStatusBar();
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              Keyboard.dismiss();
              setShowEmailModal(false);
              setEmailInput('');
              setPendingAmount(null);
              applyDefaultStatusBar();
            }}
          />
          <View
            style={{
              backgroundColor: Colors.backgroundLight,
              borderTopLeftRadius: BorderRadius.default,
              borderTopRightRadius: BorderRadius.default,
              paddingTop: 20,
              paddingHorizontal: Spacing.lg,
              paddingBottom: emailKeyboardInset > 0 ? emailKeyboardInset + 16 : Math.max(insets.bottom, 24),
              borderWidth: 1,
              borderColor: Colors.border,
              borderBottomWidth: 0,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: Colors.border,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                textAlign: 'center',
                letterSpacing: -0.4,
                marginBottom: 8,
              }}
            >
              Your email
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginBottom: 20,
                textAlign: 'center',
                lineHeight: 21,
                paddingHorizontal: 8,
              }}
            >
              We use this for your payment receipt and wallet confirmation.
            </Text>

            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.md,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: 20,
              }}
            >
              <TextInput
                ref={emailInputRef}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="you@email.com"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                  minHeight: 24,
                }}
                placeholderTextColor={Colors.placeholder}
              />
            </View>

            <Button
              title="Continue to payment"
              onPress={async () => {
                const trimmedEmail = emailInput.trim();
                if (!trimmedEmail || !trimmedEmail.includes('@')) {
                  showError('Please enter a valid email address.');
                  return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                  showError('Please enter a valid email address.');
                  return;
                }

                Keyboard.dismiss();
                setUserEmail(trimmedEmail);
                const amountToUse = pendingAmount || parseFloat(customAmount) || selectedAmount;
                setShowEmailModal(false);
                setEmailInput('');
                setPendingAmount(null);

                setTimeout(async () => {
                  await processCardPayment(trimmedEmail, amountToUse);
                }, 300);
              }}
              variant="primary"
              size="large"
              fullWidth
              disabled={!emailInput.trim()}
            />
          </View>
        </View>
      </Modal>
      
      {/* Toast Component */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}

