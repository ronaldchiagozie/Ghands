import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { resolveClientProfileComplete } from '@/utils/profileCompletion';

/**
 * Post-signup onboarding step: collect name / phone / gender once before home.
 * Reuses ProfileCompletionModal UI unchanged; skip (close) still lands on home.
 */
export default function ProfileCompletionScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  const goHome = useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const complete = await resolveClientProfileComplete();
      if (cancelled) return;
      if (complete) {
        goHome();
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [goHome]);

  const handleClose = () => {
    setVisible(false);
    goHome();
  };

  const handleComplete = () => {
    goHome();
  };

  if (!ready) {
    return <ScreenBootLoader />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ProfileCompletionModal visible={visible} onClose={handleClose} onComplete={handleComplete} />
    </View>
  );
}
