import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { resolveClientProfileComplete } from '@/utils/profileCompletion';
import { resetStackTo } from '@/utils/navigation';

/**
 * Post-signup onboarding step: collect name / phone / gender once before home.
 * Reuses ProfileCompletionModal UI unchanged; skip (close) still lands on home.
 */
export default function ProfileCompletionScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  /** Completing fires onClose and then onComplete - leave once, not twice. */
  const leftRef = useRef(false);

  const goHome = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    resetStackTo(router, '/(tabs)/home');
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
