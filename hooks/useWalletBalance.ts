import { walletService } from '@/services/api';
import { getErrorMessage } from '@/utils/errorMessages';
import type { WalletAccountStatus } from '@/utils/walletAccountStatus';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_WALLET_STATUS: WalletAccountStatus = {
  label: 'Active',
  tone: 'active',
  fromApi: false,
};

type WalletBalanceCache = {
  balance: number;
  walletId: string | number | null;
  accountStatus: WalletAccountStatus;
};

let cache: WalletBalanceCache | null = null;
let inflight: Promise<WalletBalanceCache> | null = null;

async function fetchWalletBalance(): Promise<WalletBalanceCache> {
  if (inflight) return inflight;

  inflight = (async () => {
    const wallet = await walletService.getWallet();
    const balanceValue =
      typeof wallet.balance === 'number'
        ? wallet.balance
        : parseFloat(String(wallet.balance)) || 0;
    const next: WalletBalanceCache = {
      balance: balanceValue,
      walletId: wallet.id ?? null,
      accountStatus: wallet.accountStatus ?? DEFAULT_WALLET_STATUS,
    };
    cache = next;
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidateWalletBalanceCache() {
  cache = null;
}

export function useWalletBalance(options?: { refreshOnFocus?: boolean; enabled?: boolean }) {
  const refreshOnFocus = options?.refreshOnFocus ?? true;
  const enabled = options?.enabled ?? true;
  const readyRef = useRef(cache !== null);
  const [balance, setBalance] = useState<number | null>(cache?.balance ?? null);
  const [walletId, setWalletId] = useState<string | number | null>(cache?.walletId ?? null);
  const [accountStatus, setAccountStatus] = useState<WalletAccountStatus>(
    cache?.accountStatus ?? DEFAULT_WALLET_STATUS,
  );
  const [isLoading, setIsLoading] = useState(cache === null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !readyRef.current) {
      setIsLoading(true);
    }
    try {
      const next = await fetchWalletBalance();
      setBalance(next.balance);
      setWalletId(next.walletId);
      setAccountStatus(next.accountStatus);
      setBalanceError(null);
      return next;
    } catch (error) {
      setBalanceError(getErrorMessage(error, 'Could not load wallet balance.'));
      throw error;
    } finally {
      readyRef.current = true;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh({ silent: readyRef.current });
  }, [enabled, refresh]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (refreshOnFocus) {
        void refresh({ silent: true });
      }
    }, [enabled, refreshOnFocus, refresh])
  );

  return { balance, walletId, accountStatus, isLoading, balanceError, refresh };
}
