import { ClientPaymentReceipt, type ClientReceiptData } from '@/components/ClientPaymentReceipt';
import { navigateBack } from '@/utils/navigation';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Share, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';

function formatNairaAmount(raw: string | undefined): string {
  if (!raw) return '0.00';
  const cleaned = raw.replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionFailedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId?: string;
    reference?: string;
    amount?: string;
    providerName?: string;
    serviceName?: string;
    totalAmount?: string;
    paymentMethod?: string;
    initiatedDate?: string;
    serviceDate?: string;
    serviceTime?: string;
    failureReason?: string;
  }>();

  const receiptData = useMemo((): ClientReceiptData => {
    const serviceDate = params.serviceDate || params.initiatedDate?.split('·')[0]?.trim() || '—';
    const serviceTime = params.serviceTime || params.initiatedDate?.split('·')[1]?.trim() || '—';
    const amount = formatNairaAmount(params.totalAmount || params.amount);
    const title = params.serviceName || params.providerName || 'Wallet transaction';
    const providerName = params.providerName || 'GHands Wallet';

    return {
      transactionId: params.transactionId || '—',
      reference: params.reference,
      jobTitle: title,
      providerName,
      serviceDate,
      serviceTime,
      serviceFee: amount,
      platformFee: formatNairaAmount('0'),
      tax: formatNairaAmount('0'),
      totalAmount: amount,
      paymentMethod: params.paymentMethod || 'Wallet',
      paymentDate: `${serviceDate} at ${serviceTime}`,
      status: 'failed',
      failureReason: params.failureReason?.trim() || undefined,
    };
  }, [params]);

  const sharePayload = useMemo(
    () =>
      [
        'GHands — Receipt (Failed)',
        `Description: ${receiptData.jobTitle}`,
        `Amount: ₦${receiptData.totalAmount}`,
        `Transaction ID: ${receiptData.transactionId}`,
        receiptData.reference ? `Reference: ${receiptData.reference}` : '',
        `Date: ${receiptData.serviceDate}`,
        `Time: ${receiptData.serviceTime}`,
        receiptData.failureReason ? `Reason: ${receiptData.failureReason}` : '',
        'Status: Failed',
      ]
        .filter(Boolean)
        .join('\n'),
    [receiptData],
  );

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: sharePayload, title: 'Receipt' });
    } catch {
      showAppAlert('Unable to share', 'Please try again.');
    }
  }, [sharePayload]);

  const handleDownload = useCallback(() => {
    showAppAlert(
      'Download',
      'A PDF receipt for failed transactions will be available in a future update. Use Share to send these details to support.',
    );
  }, []);

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="Receipt" onBack={() => navigateBack(router, '/WalletScreen')} backgroundColor={Colors.backgroundLight} />

      <View
        style={{
          flex: 1,
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingBottom: 16,
        }}
      >
        <ClientPaymentReceipt
          data={receiptData}
          onShare={handleShare}
          onDownload={handleDownload}
        />
      </View>
    </SafeAreaWrapper>
  );
}
