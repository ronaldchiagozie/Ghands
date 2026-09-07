import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService, authService } from '@/services/api';
import { AuthError } from '@/utils/errors';
import { useRouter } from 'expo-router';

const USER_LOCATION_STORAGE_KEY = '@app:user_location';
const USER_LOCATION_PLACE_ID_KEY = '@app:user_location_place_id';

interface UseUserLocationReturn {
  location: string | null;
  isLoading: boolean;
  setLocation: (value: string) => Promise<void>;
  clearLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  loadSavedLocation: () => Promise<void>;
}

const UserLocationContext = createContext<UseUserLocationReturn | null>(null);

/**
 * Single source of truth for saved service address (dropdown on home, modals, etc.).
 * Must wrap the app once so updates in LocationSearchModal reflect immediately on Home.
 */
export function UserLocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadSavedLocation = useCallback(async () => {
    try {
      setIsLoading(true);

      const companyId = await authService.getCompanyId();
      const userId = await authService.getUserId();

      if (companyId) {
        const storedLocation = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);
        setLocationState(storedLocation);
        setIsLoading(false);
        return;
      }

      const localStored = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);

      if (userId) {
        try {
          const savedLocation = await locationService.getUserLocation(userId);
          if (savedLocation?.fullAddress) {
            const apiAddr = savedLocation.fullAddress.trim();
            const localAddr = (localStored || '').trim();
            // If user just saved a new address locally, API can lag - don't overwrite UI with stale server row
            const useAddr =
              localAddr && localAddr !== apiAddr ? localAddr : savedLocation.fullAddress;
            await AsyncStorage.setItem(USER_LOCATION_STORAGE_KEY, useAddr);
            if (savedLocation.placeId) {
              await AsyncStorage.setItem(USER_LOCATION_PLACE_ID_KEY, savedLocation.placeId);
            }
            setLocationState(useAddr);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          if (error instanceof AuthError) {
            const { handleAuthErrorRedirect } = await import('@/utils/authRedirect');
            await handleAuthErrorRedirect(router);
            return;
          }
        }
      }

      const storedLocation = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);
      setLocationState(storedLocation);
    } catch (error) {
      console.error('Error loading stored location:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSavedLocation();
  }, [loadSavedLocation]);

  const setLocation = useCallback(async (value: string) => {
    try {
      await AsyncStorage.setItem(USER_LOCATION_STORAGE_KEY, value);
      setLocationState(value);
    } catch (error) {
      console.error('Error saving location:', error);
    }
  }, []);

  const clearLocation = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([USER_LOCATION_STORAGE_KEY, USER_LOCATION_PLACE_ID_KEY]);
      setLocationState(null);
    } catch (error) {
      console.error('Error clearing location:', error);
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    await loadSavedLocation();
  }, [loadSavedLocation]);

  const value = useMemo(
    () => ({
      location,
      isLoading,
      setLocation,
      clearLocation,
      refreshLocation,
      loadSavedLocation,
    }),
    [location, isLoading, setLocation, clearLocation, refreshLocation, loadSavedLocation]
  );

  return (
    <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
  );
}

export function useUserLocation(): UseUserLocationReturn {
  const ctx = useContext(UserLocationContext);
  if (!ctx) {
    throw new Error('useUserLocation must be used within UserLocationProvider');
  }
  return ctx;
}

export { USER_LOCATION_STORAGE_KEY, USER_LOCATION_PLACE_ID_KEY };
