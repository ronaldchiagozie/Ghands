import { ClientPaymentReceipt, type ClientReceiptData } from '@/components/ClientPaymentReceipt';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { serviceRequestService } from '@/services/api';
import { exitPaymentToJob, navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, ScrollView, Share, Text, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { shareReceipt } from '@/utils/shareReceipt';
import Confetti from '@/components/Confetti';
import { isReceiptTransactionId, shareReceiptPdf } from '@/utils/receiptPdf';

const formatDate = (date: Date, format: string = 'MMM dd, yyyy'): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');

  if (format.includes('MMMM')) {
    return format
      .replace('MMMM', fullMonths[month])
      .replace('dd', day.toString().padStart(2, '0'))
      .replace('yyyy', year.toString())
      .replace('MMM', months[month])
      .replace('MM', (month + 1).toString().padStart(2, '0'))
      .replace('h:mm a', `${displayHours}:${displayMinutes} ${period}`);
  }

  return format
    .replace('MMM', months[month])
    .replace('MM', (month + 1).toString().padStart(2, '0'))
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('yyyy', year.toString())
    .replace('h:mm a', `${displayHours}:${displayMinutes} ${period}`);
};

const parseMoneyValue = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatMoney = (value: number): string =>
  value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildReceiptFromParams(params: {
  transactionId?: string;
  reference?: string;
  providerName?: string;
  serviceName?: string;
  amount?: string;
  status?: 'completed' | 'pending' | 'failed';
  serviceDate?: string;
  serviceTime?: string;
  paymentDate?: string;
}): ClientReceiptData {
  const routeAmount = parseMoneyValue(params.amount);
  const now = new Date();
  const status = params.status ?? 'completed';
  const serviceDate =
    params.serviceDate ||
    now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const serviceTime =
    params.serviceTime ||
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const paymentDate = params.paymentDate || formatDate(now, "MMM dd, yyyy 'at' h:mm a");

  return {
    transactionId: params.transactionId || params.reference || `TXN-${Date.now()}`,
    reference: params.reference,
    jobTitle: params.serviceName || 'Service',
    providerName: params.providerName || 'Provider',
    serviceDate,
    serviceTime,
    serviceFee: formatMoney(routeAmount),
    platformFee: formatMoney(0),
    tax: formatMoney(0),
    totalAmount: formatMoney(routeAmount),
    paymentMethod: 'Wallet',
    paymentDate,
    status,
  };
}

export default function PaymentSuccessfulScreen() {
  /**
    * The card itself, so a share captures the document rather than the screen
    * around it - the header and the buttons are controls, not part of it.
    */
  const receiptRef = useRef<View>(null);
  /**
   * True only while the card is being photographed. The buttons come out and
   * the brand mark goes in, so what lands in somebody's chat is a signed
   * document rather than a screenshot of an app with a Download button on it.
   */
  const [isCapturing, setIsCapturing] = useState(false);
  /**
   * Fires once, on a completed payment only.
   *
   * Booking a tradesman is a small act of trust that runs for days - somebody
   * came into your home, did work you cannot easily judge, and you paid for
   * it. The end of that is the one moment in this app where a flourish is the
   * honest response rather than decoration. A pending or failed payment gets
   * nothing: celebrating either would be the app congratulating itself over
   * something that has not happened.
   */
  const [showConfetti, setShowConfetti] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId?: string;
    reference?: string;
    providerName?: string;
    serviceName?: string;
    requestId?: string;
    amount?: string;
    quotationId?: string;
    status?: 'completed' | 'pending' | 'failed';
    serviceDate?: string;
    serviceTime?: string;
    paymentDate?: string;
  }>();

  const initialReceipt = useMemo(() => buildReceiptFromParams(params), [
    params.amount,
    params.providerName,
    params.reference,
    params.serviceName,
    params.transactionId,
    params.status,
    params.serviceDate,
    params.serviceTime,
    params.paymentDate,
  ]);

  const [transactionData, setTransactionData] = useState<ClientReceiptData>(initialReceipt);
  const [isEnriching, setIsEnriching] = useState(Boolean(params.requestId));

  const handleExit = useCallback(() => {
    if (params.requestId) {
      exitPaymentToJob(router, params.requestId);
      return;
    }
    navigateBack(router, NAV_FALLBACK.clientJobs);
  }, [params.requestId, router]);

  const enrichReceiptFromRequest = useCallback(async () => {
    if (!params.requestId) {
      setIsEnriching(false);
      return;
    }

    const requestId = parseInt(params.requestId, 10);
    if (Number.isNaN(requestId)) {
      setIsEnriching(false);
      return;
    }

    const fallback = buildReceiptFromParams(params);

    try {
      const [request, quotations] = await Promise.all([
        serviceRequestService.getRequestDetails(requestId).catch(() => null),
        serviceRequestService.getQuotations(requestId).catch(() => []),
      ]);

      const quotation =
        quotations.find((q: { id?: number; status?: string }) =>
          params.quotationId ? String(q.id) === String(params.quotationId) : q.status === 'accepted',
        ) ||
        quotations.find((q: { status?: string }) => q.status === 'accepted') ||
        quotations[0] ||
        null;

      const laborCost = quotation?.laborCost || 0;
      const logisticsCost = quotation?.logisticsCost || 0;
      const materialsCost =
        quotation?.materials?.reduce(
          (sum: number, mat: { unitPrice?: number; quantity?: number }) =>
            sum + (mat.unitPrice || 0) * (mat.quantity || 0),
          0,
        ) || 0;
      const lineServiceFee = laborCost + logisticsCost + materialsCost;
      const routeAmount = parseMoneyValue(params.amount);
      const serviceFeeNum = lineServiceFee > 0 ? lineServiceFee : routeAmount;
      const platformFee = quotation?.serviceCharge || 0;
      const tax = quotation?.tax ?? 0;
      const qTotal = quotation?.total;
      const totalAmountNum =
        qTotal != null && parseMoneyValue(qTotal) > 0 ? parseMoneyValue(qTotal) : routeAmount;

      let serviceDate = fallback.serviceDate;
      let serviceTime = fallback.serviceTime;
      if (request) {
        serviceDate = request.scheduledDate
          ? formatDate(new Date(request.scheduledDate), 'MMMM dd, yyyy')
          : request.createdAt
            ? formatDate(new Date(request.createdAt), 'MMMM dd, yyyy')
            : fallback.serviceDate;
        serviceTime = request.scheduledTime || fallback.serviceTime;
      }

      const acceptedAt = (quotation as { acceptedAt?: string } | null)?.acceptedAt;
      const paymentDate = acceptedAt
        ? formatDate(new Date(acceptedAt), "MMM dd, yyyy 'at' h:mm a")
        : fallback.paymentDate;

      setTransactionData({
        transactionId: params.transactionId || params.reference || fallback.transactionId,
        reference: params.reference ?? fallback.reference,
        jobTitle:
          (request && (request.jobTitle || request.description)) ||
          params.serviceName ||
          fallback.jobTitle,
        providerName: quotation?.provider?.name || params.providerName || fallback.providerName,
        serviceDate,
        serviceTime,
        serviceFee: formatMoney(serviceFeeNum),
        platformFee: formatMoney(platformFee),
        tax: formatMoney(typeof tax === 'number' ? tax : parseFloat(String(tax)) || 0),
        totalAmount: formatMoney(totalAmountNum),
        paymentMethod: 'Wallet',
        paymentDate,
        status: params.status ?? fallback.status ?? 'completed',
      });
    } catch (error) {
      if (__DEV__) {
        console.warn('[PaymentSuccessful] Enrichment failed, keeping route receipt', error);
      }
    } finally {
      setIsEnriching(false);
    }
  }, [params.amount, params.providerName, params.quotationId, params.reference, params.requestId, params.serviceName, params.status, params.transactionId]);

  useEffect(() => {
    void enrichReceiptFromRequest();
  }, [enrichReceiptFromRequest]);

  /**
   * The server's PDF when this receipt is for a wallet transaction it can look
   * up; otherwise, or if the PDF cannot be fetched, the same receipt image
   * Share makes, handed to the OS sheet.
   */
  const handleDownloadReceipt = async () => {
    if (isReceiptTransactionId(params.transactionId) && (await shareReceiptPdf(params.transactionId))) return;
    await handleShareReceipt();
  };

  const hasCelebratedRef = useRef(false);
  useEffect(() => {
    if (hasCelebratedRef.current) return;
    if (transactionData.status !== 'completed') return;
    hasCelebratedRef.current = true;
    setShowConfetti(true);
  }, [transactionData.status]);

  const handleShareReceipt = async () => {
    const statusLabel =
      transactionData.status === 'failed'
        ? 'Failed'
        : transactionData.status === 'pending'
          ? 'Pending'
          : 'Completed';
    const outcome = await shareReceipt(
      receiptRef,
      {
      transactionId: transactionData.transactionId,
      totalAmount: transactionData.totalAmount,
      statusLabel,
      },
      /**
        * Awaited on purpose. Capturing before the swap has painted would put
        * the buttons straight back into the image they were removed from.
        */
      async (capturing) => {
        setIsCapturing(capturing);
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      },
    );

    if (outcome === 'failed') {
      showAppAlert('Could not share', 'The receipt could not be shared. Please try again.');
    }
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="Receipt" onBack={handleExit} backgroundColor={Colors.backgroundLight} />

      <View
        style={{
          flex: 1,
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingBottom: 16,
        }}
      >
        {isEnriching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 8 }}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textMuted }}>
              Updating receipt details…
            </Text>
          </View>
        ) : null}

        {/** Captured on share, so what lands in a chat is the document itself. */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View ref={receiptRef} collapsable={false}>
            <ClientPaymentReceipt
              data={transactionData}
              onShare={handleShareReceipt}
              onDownload={handleDownloadReceipt}
              capturing={isCapturing}
            />
          </View>
        </ScrollView>
      </View>
      <Confetti visible={showConfetti} onDone={() => setShowConfetti(false)} />
    </SafeAreaWrapper>
  );
}
