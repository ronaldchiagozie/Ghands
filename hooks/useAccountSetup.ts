import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';

import { locationService, walletService } from '@/services/api';
import { authService } from '@/services/authService';
import { resolveClientProfileComplete } from '@/utils/profileCompletion';

/**
 * What is still outstanding on this account.
 *
 * The home screen already had a "todo" row, but it was a hardcoded array — the
 * same three cards shown to everyone forever, including people who had long
 * since done them. This resolves each one against real state so the row can
 * tell the truth and disappear when there is nothing left to do.
 *
 * Every check runs client-side against data the app already has. No new
 * endpoints are needed.
 */

const USER_LOCATION_STORAGE_KEY = '@app:user_location';

export type SetupTaskId = 'profile' | 'location' | 'pin' | 'bank' | 'notifications';

export type SetupTask = {
  id: SetupTaskId;
  title: string;
  detail: string;
  /** Blocks booking or paying — as opposed to merely recommended. */
  required: boolean;
  done: boolean;
};

const COPY: Record<SetupTaskId, { title: string; detail: string; required: boolean }> = {
  profile: {
    title: 'Add your details',
    detail: 'Providers need your name and phone to reach you.',
    required: true,
  },
  location: {
    title: 'Set your location',
    detail: 'So we can find providers near you.',
    required: true,
  },
  pin: {
    title: 'Create a wallet PIN',
    detail: 'Required before you can pay for a job.',
    required: false,
  },
  bank: {
    title: 'Add a bank account',
    detail: 'Where refunds and withdrawals are sent.',
    required: false,
  },
  notifications: {
    title: 'Turn on notifications',
    detail: 'Know the moment a provider responds.',
    required: false,
  },
};

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export function useAccountSetup() {
  const [tasks, setTasks] = useState<SetupTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    /**
     * Each check falls back to "done" on failure. A wallet call that fails
     * offline should not accuse someone of not having set a PIN they set weeks
     * ago — a missing nudge is a smaller error than a false one.
     */
    const [profile, location, wallet, banks, notifications] = await Promise.all([
      safe(() => resolveClientProfileComplete(), true),
      safe(async () => {
        /**
         * Location lives in two places: cached locally, and saved server-side via
         * /api/user/update-location. Checking only the cache would nag someone who
         * set their location on another device — so the local hit short-circuits,
         * and only a cache miss costs a round trip.
         */
        const stored = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);
        if (stored && stored.trim()) return true;

        const userId = await authService.getUserId();
        if (!userId) return true;
        const saved = await locationService.getUserLocation(Number(userId));
        return Boolean(saved);
      }, true),
      safe(async () => (await walletService.getWallet()).isPinSet, true),
      safe(async () => (await walletService.getBankAccounts()).length > 0, true),
      safe(async () => (await Notifications.getPermissionsAsync()).status === 'granted', true),
    ]);

    const done: Record<SetupTaskId, boolean> = {
      profile,
      location,
      pin: wallet,
      bank: banks,
      notifications,
    };

    setTasks(
      (Object.keys(COPY) as SetupTaskId[]).map((id) => ({
        id,
        ...COPY[id],
        done: done[id],
      })),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const outstanding = tasks.filter((t) => !t.done);

  return {
    tasks,
    outstanding,
    /** True once nothing is left — the whole section should disappear. */
    isComplete: !isLoading && outstanding.length === 0,
    completedCount: tasks.length - outstanding.length,
    totalCount: tasks.length,
    isLoading,
    refresh,
  };
}
