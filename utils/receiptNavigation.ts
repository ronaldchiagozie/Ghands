import type { Router } from 'expo-router';

type ClientReceiptParams = {
  transactionId?: string;
  requestId?: string;
  providerName?: string;
  serviceName?: string;
  amount?: string;
  reference?: string;
  quotationId?: string;
  /** From wallet transaction row — defaults to completed when omitted (post-payment flow). */
  status?: 'completed' | 'pending' | 'failed';
  serviceDate?: string;
  serviceTime?: string;
  paymentDate?: string;
  failureReason?: string;
};

type ProviderReceiptParams = {
  transactionId?: string;
  requestId?: string;
  amount?: string;
  balanceAfter?: string;
  providerName?: string;
  serviceName?: string;
  serviceDate?: string;
  serviceTime?: string;
  reference?: string;
};

function cleanParams<T extends Record<string, string | undefined>>(params: T): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => {
      const value = entry[1];
      return value != null && value !== '';
    })
  );
}

/** Client payment receipt — PaymentSuccessfulScreen */
export function openClientReceipt(router: Pick<Router, 'push'>, params: ClientReceiptParams) {
  router.push({
    pathname: '/PaymentSuccessfulScreen',
    params: cleanParams(params),
  } as any);
}

/** Provider job receipt — ProviderReceiptScreen */
export function openProviderReceipt(router: Pick<Router, 'push'>, params: ProviderReceiptParams) {
  router.push({
    pathname: '/ProviderReceiptScreen',
    params: cleanParams(params),
  } as any);
}
