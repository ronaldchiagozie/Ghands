import { providerService } from '@/services/api';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

export type EarningsTrend = 'up' | 'down' | 'flat';

type ProviderMonthlyEarningsCache = {
  thisMonth: number;
  percentChangeMonth: number;
  trendLabel: string;
  trend: EarningsTrend;
};

let cache: ProviderMonthlyEarningsCache | null = null;
let inflight: Promise<ProviderMonthlyEarningsCache> | null = null;

function formatTrendLabel(percentChange: number): { label: string; trend: EarningsTrend } {
  const rounded = Math.round(percentChange * 10) / 10;
  if (rounded === 0) {
    return { label: '0% vs last month', trend: 'flat' };
  }
  const sign = rounded > 0 ? '+' : '';
  return {
    label: `${sign}${rounded}% vs last month`,
    trend: rounded > 0 ? 'up' : 'down',
  };
}

async function fetchProviderMonthlyEarnings(): Promise<ProviderMonthlyEarningsCache> {
  if (inflight) return inflight;

  inflight = (async () => {
    const analytics = await providerService.getProviderAnalytics();
    const thisMonth = analytics.earningsOverview.thisMonth ?? 0;
    const percentChangeMonth = analytics.earningsOverview.percentChangeMonth ?? 0;
    const { label, trend } = formatTrendLabel(percentChangeMonth);
    const next: ProviderMonthlyEarningsCache = {
      thisMonth,
      percentChangeMonth,
      trendLabel: label,
      trend,
    };
    cache = next;
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidateProviderMonthlyEarningsCache() {
  cache = null;
}

export function useProviderMonthlyEarnings(options?: { refreshOnFocus?: boolean }) {
  const refreshOnFocus = options?.refreshOnFocus ?? false;
  const readyRef = useRef(cache !== null);
  const [thisMonth, setThisMonth] = useState<number | null>(cache?.thisMonth ?? null);
  const [percentChangeMonth, setPercentChangeMonth] = useState(cache?.percentChangeMonth ?? 0);
  const [trendLabel, setTrendLabel] = useState(cache?.trendLabel ?? '…');
  const [trend, setTrend] = useState<EarningsTrend>(cache?.trend ?? 'flat');
  const [isLoading, setIsLoading] = useState(cache === null);

  const applyCache = useCallback((next: ProviderMonthlyEarningsCache) => {
    setThisMonth(next.thisMonth);
    setPercentChangeMonth(next.percentChangeMonth);
    setTrendLabel(next.trendLabel);
    setTrend(next.trend);
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !readyRef.current) {
      setIsLoading(true);
    }
    try {
      const next = await fetchProviderMonthlyEarnings();
      applyCache(next);
      return next;
    } catch (error) {
      if (!readyRef.current) {
        applyCache({
          thisMonth: 0,
          percentChangeMonth: 0,
          trendLabel: 'No change vs last month',
          trend: 'flat',
        });
      }
      throw error;
    } finally {
      readyRef.current = true;
      setIsLoading(false);
    }
  }, [applyCache]);

  useEffect(() => {
    void refresh({ silent: readyRef.current });
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) {
        void refresh({ silent: true });
      }
    }, [refreshOnFocus, refresh])
  );

  return {
    thisMonth,
    percentChangeMonth,
    trendLabel,
    trend,
    isLoading,
    refresh,
  };
}
