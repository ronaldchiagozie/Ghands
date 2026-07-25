import { AppState, Platform, StatusBar, type AppStateStatus } from 'react-native';
import { Colors } from '@/lib/designSystem';

export const DEFAULT_STATUS_BAR_STYLE = 'dark-content' as const;
export const DEFAULT_STATUS_BAR_BACKGROUND = Colors.backgroundLight;

export const HANDY_AI_STATUS_BAR_STYLE = 'light-content' as const;
export const HANDY_AI_STATUS_BAR_BACKGROUND = '#003D4D';

/** Handy AI — white status bar icons on the teal shell. */
export function applyHandyAiStatusBar(): void {
  StatusBar.setHidden(false, 'fade');
  StatusBar.setBarStyle(HANDY_AI_STATUS_BAR_STYLE, true);
  if (Platform.OS === 'android') {
    StatusBar.setBackgroundColor(HANDY_AI_STATUS_BAR_BACKGROUND);
    StatusBar.setTranslucent(false);
  }
}

export function isHandyAiRoute(pathname: string): boolean {
  return pathname.includes('AiAssistant') || pathname.includes('AiConversations');
}

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
export function installStatusBarRestore(getPathname?: () => string): () => void {
  applyDefaultStatusBar();

  if (appStateSubscription) {
    return () => appStateSubscription?.remove();
  }

  const onChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      const path = getPathname?.() ?? '';
      if (isHandyAiRoute(path)) {
        applyHandyAiStatusBar();
      } else {
        applyDefaultStatusBar();
      }
    }
  };

  appStateSubscription = AppState.addEventListener('change', onChange);

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
