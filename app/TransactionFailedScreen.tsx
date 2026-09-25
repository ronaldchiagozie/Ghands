import { ClientPaymentReceipt, type ClientReceiptData } from '@/components/ClientPaymentReceipt';
import { navigateBack } from '@/utils/navigation';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { shareReceipt } from '@/utils/shareReceipt';
import { isReceiptTransactionId, shareReceiptPdf } from '@/utils/receiptPdf';

function formatNairaAmount(raw: string | undefined): string {
  if (!raw) return '0.00';
  const cleaned = raw.replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionFailedScreen() {
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
    const serviceDate = params.serviceDate || params.initiatedDate?.split('·')[0]?.trim() || '-';
    const serviceTime = params.serviceTime || params.initiatedDate?.split('·')[1]?.trim() || '-';
    const amount = formatNairaAmount(params.totalAmount || params.amount);
    const title = params.serviceName || params.providerName || 'Wallet transaction';
    const providerName = params.providerName || 'GHands Wallet';

    return {
      transactionId: params.transactionId || '-',
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

  const handleShare = useCallback(async () => {
    const outcome = await shareReceipt(
      receiptRef,
      {
        transactionId: receiptData.transactionId,
        totalAmount: receiptData.totalAmount,
        statusLabel: 'Failed',
      },
      /** Awaited: capturing before the swap paints would put the buttons back in the image. */
      async (capturing) => {
        setIsCapturing(capturing);
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      },
    );
    if (outcome === 'failed') {
      showAppAlert('Unable to share', 'Please try again.');
    }
  }, [receiptData.transactionId, receiptData.totalAmount]);

  /** The server's PDF for a real wallet transaction; the receipt image otherwise, or if the PDF cannot be fetched. */
  const handleDownload = useCallback(async () => {
    if (isReceiptTransactionId(params.transactionId) && (await shareReceiptPdf(params.transactionId))) return;
    await handleShare();
  }, [handleShare, params.transactionId]);

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
        {/** Captured on share, so what lands in a chat is the document. */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View ref={receiptRef} collapsable={false}>
            <ClientPaymentReceipt
              data={receiptData}
              onShare={handleShare}
              onDownload={handleDownload}
              capturing={isCapturing}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
