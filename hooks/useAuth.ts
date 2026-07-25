import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ONBOARDING_STORAGE_KEY } from './useOnboarding';
import { authService } from '@/services/api';
import { beginRoleSwitch, endRoleSwitch } from '@/hooks/useRoleSwitching';
import { markAuthSessionEnded } from '@/utils/authNavigationGuard';
import { logoutUser } from '@/utils/logoutUser';

export type UserRole = 'client' | 'provider' | null;

interface UseAuthRoleReturn {
  role: UserRole;
  setRole: (role: UserRole) => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AUTH_ROLE_KEY = '@ghands:user_role';
const AUTH_TOKEN_KEY = '@ghands:auth_token';

/**
 * Hook for managing user authentication and role
 */
export function useAuthRole(): UseAuthRoleReturn {
  const router = useRouter();
  const [role, setRoleState] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load role from storage on mount
  useEffect(() => {
    const loadRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem(AUTH_ROLE_KEY);
        if (storedRole) {
          setRoleState(storedRole as UserRole);
        }
      } catch (error) {
        console.error('Error loading role:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRole();
  }, []);

  const setRole = useCallback(async (newRole: UserRole) => {
    try {
      if (newRole) {
        await AsyncStorage.setItem(AUTH_ROLE_KEY, newRole);
      } else {
        await AsyncStorage.removeItem(AUTH_ROLE_KEY);
      }
      setRoleState(newRole);
    } catch (error) {
      console.error('Error setting role:', error);
      throw error;
    }
  }, []);

  /**
   * Switch role without going through onboarding
   * Used for demo/testing purposes
   * Navigates to the respective auth screen instead of home
   */
  const switchRole = useCallback(async (newRole: UserRole) => {
    try {
      if (!newRole) {
        throw new Error('Role cannot be null');
      }

      await beginRoleSwitch();
      markAuthSessionEnded();

      const providerKeys = [
        '@ghands:business_name',
        '@ghands:company_name',
        '@ghands:provider_id',
        '@ghands:provider_name',
        '@ghands:provider_email',
        '@ghands:company_email',
        '@ghands:company_phone',
        '@ghands:profile_complete',
      ];
      await AsyncStorage.multiRemove(providerKeys);

      await AsyncStorage.setItem(AUTH_ROLE_KEY, newRole);
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      const { unregisterPushOnLogout } = await import('@/utils/pushNotifications');
      await unregisterPushOnLogout();
      await authService.clearAuthTokens();

      setRoleState(newRole);

      if (newRole === 'provider') {
        router.replace('/ProviderSignInScreen');
      } else {
        router.replace('/LoginScreen');
      }
    } catch (error) {
      console.error('Error switching role:', error);
      throw error;
    } finally {
      await endRoleSwitch();
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await logoutUser(router);
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/LoginScreen' as never);
    }
  }, [router]);

  return {
    role,
    setRole,
    switchRole,
    logout,
    isLoading,
  };
}

