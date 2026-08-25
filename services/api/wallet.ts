import { apiClient, extractResponseData } from './client';
import type { PayForServicePayload, PayForServiceResponse } from './types';
import { logWalletApiError, logWalletApiResponse } from '@/utils/paymentFlowLog';
import { summarizeTransactionRows } from '@/utils/logSanitize';
import { mapWalletAccountStatus, type WalletAccountStatus } from '@/utils/walletAccountStatus';

export type { PayForServicePayload, PayForServiceResponse };

/**
 * Money-moving requests must never be auto-retried: these endpoints are not
 * idempotent and carry no idempotency key, so a retry after a lost response can
 * debit the wallet twice. `pin/verify` opts out too — a retry burns a PIN
 * attempt against the server's lockout counter.
 */
const NO_RETRY = { retries: 0 } as const;

export interface Bank {
  code: string;
  name: string;
}

export interface BankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  isVerified: boolean;
}

export interface ResolveAccountResponse {
  accountName: string;
  accountNumber: string;
}

export type DepositVerification = {
  reference: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  balance: number;
};

function readNumericField(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeDepositStatus(raw: unknown): 'completed' | 'pending' | 'failed' {
  const status = String(raw ?? '').toLowerCase();
  if (
    status === 'completed' ||
    status === 'success' ||
    status === 'successful' ||
    status === 'paid' ||
    status === 'approved'
  ) {
    return 'completed';
  }
  if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'declined') {
    return 'failed';
  }
  return 'pending';
}

function readBankCode(raw: Record<string, unknown>): string {
  const value =
    raw.code ??
    raw.bankCode ??
    raw.bank_code ??
    raw.nipCode ??
    raw.nip_code ??
    raw.bank_code_nibss;
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (/^\d{1,3}$/.test(s)) return s.padStart(3, '0');
  return s;
}

function readBankName(raw: Record<string, unknown>): string {
  const value = raw.name ?? raw.bankName ?? raw.bank_name ?? raw.label ?? raw.title;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractRawBankRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;

  const fromObject = (source: Record<string, unknown>): unknown[] => {
    if (Array.isArray(source.banks)) return source.banks;
    if (Array.isArray(source.data)) return source.data;
    if (Array.isArray(source.items)) return source.items;
    if (Array.isArray(source.results)) return source.results;
    if (Array.isArray(source.list)) return source.list;
    return [];
  };

  let rows = fromObject(obj);
  if (rows.length > 0) return rows;

  const nested = obj.data;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === 'object') {
    rows = fromObject(nested as Record<string, unknown>);
    if (rows.length > 0) return rows;
    const deep = (nested as Record<string, unknown>).data;
    if (Array.isArray(deep)) return deep;
  }

  return [];
}

function normalizeBanksFromApiResponse(response: unknown): Bank[] {
  const layers = [
    extractResponseData<any>(response),
    (response as any)?.data,
    response,
  ];

  let rawList: unknown[] = [];
  for (const layer of layers) {
    rawList = extractRawBankRows(layer);
    if (rawList.length > 0) break;
  }

  return rawList
    .map((row) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return { code: readBankCode(record), name: readBankName(record) };
    })
    .filter((bank) => bank.code && bank.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapDepositVerification(reference: string, verificationData: Record<string, unknown>): DepositVerification {
  const wallet =
    verificationData.wallet && typeof verificationData.wallet === 'object'
      ? (verificationData.wallet as Record<string, unknown>)
      : null;

  return {
    reference: String(verificationData.reference ?? reference),
    status: normalizeDepositStatus(verificationData.status ?? verificationData.paymentStatus),
    amount: readNumericField(
      verificationData.amount,
      verificationData.depositAmount,
      verificationData.paidAmount,
      verificationData.transactionAmount,
    ),
    balance: readNumericField(
      verificationData.balance,
      verificationData.walletBalance,
      verificationData.newBalance,
      verificationData.balanceAfter,
      wallet?.balance,
    ),
  };
}

/**
 * Payment status vocabulary, mirroring `normalizeDepositStatus`.
 *
 * Anything unrecognised — including a missing field — resolves to `pending`,
 * never `completed`. The screens poll the ledger on `pending` and reach a real
 * verdict; treating an unknown status as success would show a receipt for a
 * payment that may have failed.
 */
function normalizePaymentStatus(raw: unknown): 'completed' | 'pending' | 'failed' {
  const status = String(raw ?? '').toLowerCase();
  if (
    status === 'completed' ||
    status === 'success' ||
    status === 'successful' ||
    status === 'paid' ||
    status === 'approved'
  ) {
    return 'completed';
  }
  if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'declined') {
    return 'failed';
  }
  return 'pending';
}

/** A layer is the payment result if it carries any of the fields we read off it. */
function isPaymentResultShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return 'reference' in row || 'status' in row || 'transactionId' in row;
}

/**
 * `/pay` and `/pay-logistics-fee` were unwrapped differently — one read
 * `response.data`, the other `response.data.data ?? response.data` — so one of
 * them was wrong for any given response shape. Getting it wrong is not a cosmetic
 * bug: a result read off the wrong layer has no `status`, and the payment screens
 * treat a statusless 2xx as a completed debit.
 *
 * Rather than pick a shape, find the layer that actually carries the result.
 * Deepest first, so a genuinely double-wrapped body wins over its envelope.
 */
function normalizePaymentResponse(response: unknown, requestId: number): PayForServiceResponse {
  const envelope = response as Record<string, any> | undefined;
  const layers = [envelope?.data?.data, envelope?.data, envelope];
  const result = layers.find(isPaymentResultShape) ?? {};

  const reference = String(result.reference ?? result.transactionId ?? '').trim();

  return {
    reference,
    status: normalizePaymentStatus(result.status ?? result.paymentStatus),
    amount: readNumericField(result.amount, result.paidAmount, result.transactionAmount),
    balance: readNumericField(result.balance, result.walletBalance, result.newBalance, result.balanceAfter),
    requestId: Number(result.requestId ?? requestId),
  };
}

export const walletService = {
  getWallet: async (): Promise<{
    id: number;
    balance: number;
    currency: string;
    isPinSet: boolean;
    accountStatus: WalletAccountStatus;
  }> => {
    const response = await apiClient.get<any>('/api/wallet');
    const responseData = extractResponseData<any>(response);
    const walletData = responseData?.data || responseData;
    if (!walletData) throw new Error('Invalid response from wallet API.');
    const balance = typeof walletData.balance === 'number' ? walletData.balance : parseFloat(walletData.balance) || 0;
    const accountStatus = mapWalletAccountStatus(
      typeof walletData === 'object' && walletData !== null ? (walletData as Record<string, unknown>) : {},
    );
    const result = {
      id: walletData.id || 0,
      balance,
      currency: walletData.currency || 'NGN',
      isPinSet: walletData.isPinSet || false,
      accountStatus,
    };
    void logWalletApiResponse('API GET /api/wallet', {}, { wallet: result, raw: walletData });
    return result;
  },

  setPin: async (payload: { pin: string; confirmPin: string }): Promise<{ message: string }> => {
    const response = await apiClient.post<any>('/api/wallet/pin', payload);
    return (response as any).data;
  },

  changePin: async (payload: { oldPin: string; newPin: string; confirmPin: string }): Promise<{ message: string }> => {
    const response = await apiClient.put<any>('/api/wallet/pin', payload);
    return (response as any).data;
  },

  verifyPin: async (pin: string): Promise<{ isValid: boolean }> => {
    const response = await apiClient.post<any>('/api/wallet/pin/verify', { pin }, NO_RETRY);
    const data = extractResponseData<any>(response)?.data || extractResponseData<any>(response);
    return { isValid: data?.isValid ?? false };
  },

  initializeDeposit: async (payload: {
    amount: number;
    email: string;
    name?: string;
    phone?: string;
    /** Used only client-side for openAuthSessionAsync — not sent to API. */
    callbackUrl?: string;
  }): Promise<{ authorizationUrl: string; reference: string }> => {
    const { callbackUrl: _callbackUrl, ...apiPayload } = payload;
    const response = await apiClient.post<any>('/api/wallet/deposit', apiPayload);
    const responseData = extractResponseData<any>(response);
    const depositData = responseData?.data || responseData;
    if (!depositData?.authorizationUrl || !depositData?.reference) {
      throw new Error('Invalid response from deposit API. Missing authorizationUrl or reference.');
    }
    const result = { authorizationUrl: depositData.authorizationUrl, reference: depositData.reference };
    void logWalletApiResponse(
      'API POST /api/wallet/deposit',
      { reference: result.reference, detail: `amount=${apiPayload.amount}` },
      depositData,
    );
    return result;
  },

  verifyDeposit: async (reference: string): Promise<DepositVerification> => {
    try {
      const response = await apiClient.get<any>(`/api/wallet/deposit/verify/${reference}`);
      const responseData = extractResponseData<any>(response);
      const verificationData = (responseData?.data || responseData) as Record<string, unknown>;
      if (!verificationData || typeof verificationData !== 'object') {
        throw new Error('Invalid response from verification API.');
      }

      const mapped = mapDepositVerification(reference, verificationData);
      void logWalletApiResponse(
        'API GET /api/wallet/deposit/verify',
        { reference, detail: `mappedStatus=${mapped.status}` },
        { raw: verificationData, mapped },
      );
      return mapped;
    } catch (error: unknown) {
      const msg = String((error as Error)?.message ?? '').toLowerCase();
      if (msg.includes('processing') || msg.includes('pending')) {
        void logWalletApiResponse(
          'API GET /api/wallet/deposit/verify (pending)',
          { reference },
          { status: 'pending', message: (error as Error)?.message },
        );
        return { reference, status: 'pending', amount: 0, balance: 0 };
      }
      void logWalletApiError('API GET /api/wallet/deposit/verify (error)', { reference }, error);
      throw error;
    }
  },

  payForService: async (payload: PayForServicePayload): Promise<PayForServiceResponse> => {
    try {
      const response = await apiClient.post<any>('/api/wallet/pay', payload, NO_RETRY);
      const data = normalizePaymentResponse(response, payload.requestId);
      void logWalletApiResponse(
        'API POST /api/wallet/pay',
        { detail: `requestId=${payload.requestId}`, transactionId: String(payload.requestId) },
        { normalized: data, raw: response },
      );
      return data;
    } catch (error) {
      void logWalletApiError(
        'API POST /api/wallet/pay (error)',
        { detail: `requestId=${payload.requestId}` },
        error,
      );
      throw error;
    }
  },

  payLogisticsFee: async (payload: { requestId: number; amount: number; pin: string }): Promise<PayForServiceResponse> => {
    try {
      const response = await apiClient.post<any>('/api/wallet/pay-logistics-fee', payload, NO_RETRY);
      const data = normalizePaymentResponse(response, payload.requestId);
      void logWalletApiResponse(
        'API POST /api/wallet/pay-logistics-fee',
        { detail: `requestId=${payload.requestId}` },
        { normalized: data, raw: response },
      );
      return data;
    } catch (error) {
      void logWalletApiError(
        'API POST /api/wallet/pay-logistics-fee (error)',
        { detail: `requestId=${payload.requestId}` },
        error,
      );
      throw error;
    }
  },

  withdraw: async (payload: { bankAccountId: number; amount: number; pin: string; narration?: string }): Promise<{
    reference: string;
    status: string;
    amount: number;
    balance: number;
  }> => {
    const response = await apiClient.post<any>('/api/wallet/withdraw', payload, NO_RETRY);
    const data = extractResponseData<any>(response)?.data || extractResponseData<any>(response);
    return {
      reference: data?.reference || '',
      status: data?.status || 'pending',
      amount: data?.amount || payload.amount,
      balance: data?.balance ?? 0,
    };
  },

  getBanks: async (countryCode: string = 'NG'): Promise<Bank[]> => {
    const response = await apiClient.get<any>(
      `/api/wallet/banks?countryCode=${encodeURIComponent(countryCode)}`,
    );
    const banks = normalizeBanksFromApiResponse(response);
    if (__DEV__ && banks.length === 0) {
      console.log(
        '[WalletActivity] GET /api/wallet/banks parsed 0 rows; raw keys:',
        response && typeof response === 'object' ? Object.keys(response as object) : typeof response,
      );
    }
    void logWalletApiResponse(
      'API GET /api/wallet/banks',
      { detail: `countryCode=${countryCode}` },
      { count: banks.length, sample: banks.slice(0, 3) },
    );
    return banks;
  },

  resolveBankAccount: async (bankCode: string, accountNumber: string): Promise<ResolveAccountResponse> => {
    const response = await apiClient.post<any>('/api/wallet/banks/resolve', { bankCode, accountNumber });
    const data = extractResponseData<any>(response)?.data || extractResponseData<any>(response);
    return {
      accountName: String(data?.accountName ?? data?.account_name ?? '').trim(),
      accountNumber: String(data?.accountNumber ?? data?.account_number ?? accountNumber).trim(),
    };
  },

  getBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get<any>('/api/wallet/bank-accounts');
    const data = extractResponseData<any>(response);
    const list = Array.isArray(data) ? data : (data?.data || []);
    return list.map((a: any) => ({
      id: a.id,
      bankName: a.bankName || a.bank_name || '',
      accountNumber: a.accountNumber || a.account_number || '',
      accountName: a.accountName || a.account_name || '',
      isDefault: !!a.isDefault || !!a.is_default,
      isVerified: a.isVerified !== false && a.is_verified !== false,
    }));
  },

  addBankAccount: async (payload: { bankName: string; bankCode: string; accountNumber: string }): Promise<BankAccount> => {
    const response = await apiClient.post<any>('/api/wallet/bank-accounts', payload);
    const data = extractResponseData<any>(response)?.data || extractResponseData<any>(response);
    return {
      id: data?.id,
      bankName: data?.bankName || payload.bankName,
      accountNumber: data?.accountNumber || payload.accountNumber,
      accountName: data?.accountName || '',
      isDefault: !!data?.isDefault,
      isVerified: data?.isVerified !== false,
    };
  },

  setDefaultBankAccount: async (accountId: number): Promise<{ id: number; isDefault: boolean }> => {
    const response = await apiClient.put<any>(`/api/wallet/bank-accounts/${accountId}/default`, {});
    const data = extractResponseData<any>(response)?.data || extractResponseData<any>(response);
    return { id: data?.id ?? accountId, isDefault: true };
  },

  deleteBankAccount: async (accountId: number): Promise<void> => {
    await apiClient.delete<any>(`/api/wallet/bank-accounts/${accountId}`);
  },

  getTransactions: async (options?: { limit?: number; offset?: number }): Promise<{
    transactions: Array<{
      id: number;
      reference: string;
      type: 'deposit' | 'withdrawal' | 'payment' | 'earnings' | 'refund' | 'transfer';
      status: 'pending' | 'completed' | 'failed' | 'cancelled';
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      description: string;
      createdAt: string;
      completedAt?: string | null;
      requestId?: number | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> => {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const query = `?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    const response = await apiClient.get<any>(`/api/wallet/transactions${query}`);
    const responseData = extractResponseData<any>(response);
    const inner = responseData?.data?.data || responseData?.data || responseData;
    const transactions = inner?.transactions || [];
    const result = {
      transactions,
      total: inner?.total ?? transactions.length,
      limit: inner?.limit ?? limit,
      offset: inner?.offset ?? offset,
    };
    void logWalletApiResponse(
      'API GET /api/wallet/transactions',
      { detail: `count=${transactions.length} total=${result.total}` },
      {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        transactions: summarizeTransactionRows(transactions as Array<Record<string, unknown>>),
      },
    );
    return result;
  },
};
