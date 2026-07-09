import { AppState, Platform, StatusBar, type AppStateStatus } from 'react-native';
import { Colors } from '@/lib/designSystem';

export const DEFAULT_STATUS_BAR_STYLE = 'dark-content' as const;
export const DEFAULT_STATUS_BAR_BACKGROUND = Colors.backgroundLight;

/** Re-apply the standard light-screen status bar (visible, dark icons on white). */
export function applyDefaultStatusBar(): void {
  StatusBar.setHidden(false, 'fade');
  StatusBar.setBarStyle(DEFAULT_STATUS_BAR_STYLE, true);
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(DEFAULT_STATUS_BAR_BACKGROUND);
    StatusBar.setTranslucent(false);
  }
}

let appStateSubscription: { remove: () => void } | null = null;

/** Call once from root layout — restores status bar when returning from browser / background. */
export function installStatusBarRestore(): () => void {
  applyDefaultStatusBar();

  if (appStateSubscription) {
    return () => appStateSubscription?.remove();
  }

  const onChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      applyDefaultStatusBar();
    }
  };

  appStateSubscription = AppState.addEventListener('change', onChange);

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
