import { ClientPaymentReceipt, type ClientReceiptData } from '@/components/ClientPaymentReceipt';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { serviceRequestService } from '@/services/api';
import { exitPaymentToJob, navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Share, Text, View } from 'react-native';

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
}): ClientReceiptData {
  const routeAmount = parseMoneyValue(params.amount);
  const now = new Date();

  return {
    transactionId: params.transactionId || params.reference || `TXN-${Date.now()}`,
    jobTitle: params.serviceName || 'Service',
    providerName: params.providerName || 'Provider',
    serviceDate: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    serviceTime: 'N/A',
    serviceFee: formatMoney(routeAmount),
    platformFee: formatMoney(0),
    tax: formatMoney(0),
    totalAmount: formatMoney(routeAmount),
    paymentMethod: 'Wallet',
    paymentDate: formatDate(now, "MMM dd, yyyy 'at' h:mm a"),
  };
}

export default function PaymentSuccessfulScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId?: string;
    reference?: string;
    providerName?: string;
    serviceName?: string;
    requestId?: string;
    amount?: string;
    quotationId?: string;
  }>();

  const initialReceipt = useMemo(() => buildReceiptFromParams(params), [
    params.amount,
    params.providerName,
    params.reference,
    params.serviceName,
    params.transactionId,
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
        serviceTime = request.scheduledTime || 'N/A';
      }

      const acceptedAt = (quotation as { acceptedAt?: string } | null)?.acceptedAt;
      const paymentDate = acceptedAt
        ? formatDate(new Date(acceptedAt), "MMM dd, yyyy 'at' h:mm a")
        : fallback.paymentDate;

      setTransactionData({
        transactionId: params.transactionId || params.reference || fallback.transactionId,
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
      });
    } catch (error) {
      if (__DEV__) {
        console.warn('[PaymentSuccessful] Enrichment failed, keeping route receipt', error);
      }
    } finally {
      setIsEnriching(false);
    }
  }, [params.amount, params.providerName, params.quotationId, params.reference, params.requestId, params.serviceName, params.transactionId]);

  useEffect(() => {
    void enrichReceiptFromRequest();
  }, [enrichReceiptFromRequest]);

  const handleDownloadReceipt = () => {
    Alert.alert('Download', 'Receipt will be downloaded shortly.');
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        message: `Payment Receipt\nTransaction ID: ${transactionData.transactionId}\nAmount: ₦${transactionData.totalAmount}`,
        title: 'Payment Receipt',
      });
    } catch {
      Alert.alert('Error', 'Failed to share receipt');
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

        <ClientPaymentReceipt
          data={transactionData}
          onShare={handleShareReceipt}
          onDownload={handleDownloadReceipt}
          onViewJob={handleExit}
          showViewJob={Boolean(params.requestId)}
        />
      </View>
    </SafeAreaWrapper>
  );
}
