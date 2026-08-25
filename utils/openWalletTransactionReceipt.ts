import type { Router } from 'expo-router';
import { openClientReceipt } from '@/utils/receiptNavigation';
import {
  extractWalletTransactionFailureReason,
  mapWalletTransactionStatus,
  walletTransactionTimestamp,
  type WalletTransactionRow,
} from '@/utils/walletTransactions';

function formatTxDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  } catch {
    return { date: '—', time: '—' };
  }
}

function labelForWalletTx(tx: WalletTransactionRow): { serviceName: string; serviceDescription: string } {
  const type = String(tx.type ?? '').toLowerCase();
  if (type === 'deposit') {
    return { serviceName: 'Wallet Deposit', serviceDescription: 'Funds added to wallet' };
  }
  if (type === 'withdrawal') {
    return { serviceName: 'Withdrawal', serviceDescription: 'Funds withdrawn to bank' };
  }
  if (type === 'payment') {
    return { serviceName: 'Service Payment', serviceDescription: String(tx.description ?? 'Wallet payment') };
  }
  return {
    serviceName: 'Wallet transaction',
    serviceDescription: String(tx.description ?? 'Wallet activity'),
  };
}

/** Open the correct receipt / pending / failed screen for a wallet ledger row. */
export function openWalletTransactionReceipt(
  router: Pick<Router, 'push'>,
  tx: WalletTransactionRow,
): void {
  const status = mapWalletTransactionStatus(tx);
  const amount = Math.abs(typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 0);
  const { date, time } = formatTxDateTime(walletTransactionTimestamp(tx));
  const { serviceName, serviceDescription } = labelForWalletTx(tx);
  const id = String(tx.id ?? '');
  const reference = tx.reference ? String(tx.reference) : undefined;
  const failureReason = status === 'failed' ? extractWalletTransactionFailureReason(tx) : undefined;

  if (status === 'failed') {
    router.push({
      pathname: '/TransactionFailedScreen',
      params: {
        transactionId: id,
        reference,
        amount: amount.toString(),
        providerName: serviceName,
        serviceName: serviceDescription,
        totalAmount: amount.toFixed(2),
        paymentMethod: 'Wallet',
        serviceDate: date,
        serviceTime: time,
        initiatedDate: `${date} · ${time}`,
        failureReason,
      },
    } as any);
    return;
  }

  if (status === 'pending') {
    /** Same field set as the failed/completed receipts — all three render ClientPaymentReceipt. */
    router.push({
      pathname: '/PaymentPendingScreen',
      params: {
        transactionId: id,
        reference,
        amount: amount.toString(),
        providerName: serviceName,
        serviceName: serviceDescription,
        totalAmount: amount.toFixed(2),
        paymentMethod: 'Wallet',
        serviceDate: date,
        serviceTime: time,
        initiatedDate: `${date} · ${time}`,
      },
    } as any);
    return;
  }

  openClientReceipt(router, {
    transactionId: id,
    reference,
    providerName: serviceName,
    serviceName: serviceDescription,
    amount: amount.toString(),
    status: 'completed',
    serviceDate: date,
    serviceTime: time,
    paymentDate: `${date} at ${time}`,
  });
}
