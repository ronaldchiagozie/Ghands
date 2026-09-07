import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const ROLE_SWITCHING_KEY = '@ghands:role_switching';

/** Safety net - never leave the app blank if the flag fails to clear. */
const STUCK_SWITCH_MS = 3500;

export async function beginRoleSwitch(): Promise<void> {
  await AsyncStorage.setItem(ROLE_SWITCHING_KEY, 'true');
}

export async function endRoleSwitch(): Promise<void> {
  await AsyncStorage.removeItem(ROLE_SWITCHING_KEY);
}

export async function isRoleSwitchInProgress(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ROLE_SWITCHING_KEY);
  return value === 'true';
}

/**
 * Tracks demo role switches so tab layouts and token guards don't fight navigation.
 * Auto-clears a stuck flag after {@link STUCK_SWITCH_MS}.
 */
/** Cleared once per JS session so a stale AsyncStorage flag cannot blank the app forever. */
let clearedStaleSwitchFlagOnBoot = false;

export function useRoleSwitching(): boolean {
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  useEffect(() => {
    let mounted = true;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;

    const sync = async () => {
      const switching = await isRoleSwitchInProgress();
      if (!mounted) return;

      setIsSwitchingRole(switching);

      if (stuckTimer) {
        clearTimeout(stuckTimer);
        stuckTimer = null;
      }

      if (switching) {
        stuckTimer = setTimeout(async () => {
          await endRoleSwitch();
          if (mounted) setIsSwitchingRole(false);
        }, STUCK_SWITCH_MS);
      }
    };

    const init = async () => {
      if (!clearedStaleSwitchFlagOnBoot) {
        clearedStaleSwitchFlagOnBoot = true;
        await endRoleSwitch();
        if (mounted) setIsSwitchingRole(false);
      }
      await sync();
    };

    void init();

    const interval = setInterval(() => {
      void sync();
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (stuckTimer) clearTimeout(stuckTimer);
    };
  }, []);

  return isSwitchingRole;
}
