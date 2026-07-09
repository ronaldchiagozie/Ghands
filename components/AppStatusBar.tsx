import { DEFAULT_STATUS_BAR_BACKGROUND, DEFAULT_STATUS_BAR_STYLE } from '@/utils/statusBar';
import React from 'react';
import { StatusBar } from 'react-native';

/** Root status bar — keep visible on all screens; use applyDefaultStatusBar() after modals / browser. */
export default function AppStatusBar() {
  return (
    <StatusBar
      barStyle={DEFAULT_STATUS_BAR_STYLE}
      backgroundColor={DEFAULT_STATUS_BAR_BACKGROUND}
      translucent={false}
      hidden={false}
      animated
    />
  );
}
