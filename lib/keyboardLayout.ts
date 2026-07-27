import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { computePhoneLaneHeight, isTabletSize } from './tabletLayout';

/**
 * Corrects `KeyboardAvoidingView`'s frame measurement for screens rendered inside
 * `SafeAreaWrapper`.
 *
 * RN reads its own frame from `onLayout`, which is **parent-relative**, then compares
 * `frame.y + frame.height` against the keyboard's **screen** Y. Any vertical offset
 * between the window top and the view's parent is therefore invisible to it, and the
 * padding comes up short by exactly that amount.
 *
 * Under `SafeAreaWrapper` that offset is the top safe-area inset — about 47pt on a
 * notched iPhone — which is enough to leave the last field or the submit button
 * under the keyboard. `keyboardVerticalOffset` adds it back.
 *
 * Android returns 0: `softwareKeyboardLayoutMode` is `pan` (see `app.config.js`), so
 * these screens pass `behavior={undefined}` and the view is inert.
 *
 * Do NOT use this for a `KeyboardAvoidingView` inside a `Modal` — a modal's root is
 * the full window, so its frame is already screen-aligned and this would over-pad.
 */
export function useKeyboardAvoidingOffset(): number {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'ios') return 0;

  if (!isTabletSize(width, height)) {
    return insets.top;
  }

  // On tablet `TabletRootFrame` centres a fixed-height lane, and SafeAreaWrapper drops
  // its top edge, so the offset is the frame's own inset plus the centring gap.
  const laneHeight = computePhoneLaneHeight(height, insets.top, insets.bottom);
  const centeringGap = Math.max((height - insets.top - insets.bottom - laneHeight) / 2, 0);

  return insets.top + centeringGap;
}

type ScrollViewKeyboardAssistOptions = {
  /** Scroll padding while the keyboard is open — clears sticky footers. */
  footerClearance?: number;
  baseBottomPad?: number;
};

/**
 * Pairs with `KeyboardAvoidingView`: lifts the layout, then scrolls the focused
 * field into view (KAV alone does not scroll `ScrollView` content).
 */
export function useScrollViewKeyboardAssist(options: ScrollViewKeyboardAssistOptions = {}) {
  const { footerClearance = 96, baseBottomPad = 32 } = options;
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (_event: KeyboardEvent) => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollBottomPad = keyboardOpen ? footerClearance : baseBottomPad;

  const scrollFieldIntoView = useCallback((sectionY: number, scrollToEnd = false) => {
    const delay = Platform.OS === 'ios' ? 280 : 120;
    setTimeout(() => {
      if (scrollToEnd) {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      scrollRef.current?.scrollTo({
        y: Math.max(0, sectionY - 12),
        animated: true,
      });
    }, delay);
  }, []);

  const captureSectionY = useCallback((event: LayoutChangeEvent) => {
    return event.nativeEvent.layout.y;
  }, []);

  return {
    scrollRef,
    scrollBottomPad,
    scrollFieldIntoView,
    captureSectionY,
  };
}
