import { useState, useEffect, useCallback } from 'react';
import { InteractionManager } from 'react-native';

import { authService } from '@/services/authService';
import {
  resolveClientProfileComplete,
  writeProfileCompleteFlag,
} from '@/utils/profileCompletion';

/**
 * Tracks whether the user has completed the first-time profile modal (name, phone, gender)
 * during the booking flow. Once complete (local flag or server profile), modal stays hidden.
 */
export function useProfileCompletion() {
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkProfileComplete = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const complete = await resolveClientProfileComplete();
      setIsProfileComplete(complete);
      return complete;
    } catch (error) {
      console.error('Error checking profile completion:', error);
      setIsProfileComplete(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      checkProfileComplete();
    });
    return () => task.cancel();
  }, [checkProfileComplete]);

  const markProfileComplete = async () => {
    try {
      const userId = await authService.getUserId();
      await writeProfileCompleteFlag(userId);
      setIsProfileComplete(true);
    } catch (error) {
      console.error('Error marking profile complete:', error);
    }
  };

  return {
    isProfileComplete,
    isLoading,
    checkProfileComplete,
    markProfileComplete,
  };
}
