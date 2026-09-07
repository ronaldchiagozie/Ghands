import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET } from '@/lib/designSystem';

/**
 * Full-screen viewer for images the app shows as thumbnails.
 *
 * A 76px tile is enough to know a photo is there and not enough to see what is
 * in it. Somebody sending Handy a picture of a leak, or a provider checking the
 * damage they are being asked to quote for, needs the actual image.
 *
 * Deliberately general rather than living inside the chat: job photos and
 * portfolio images want exactly this, and a second implementation would drift.
 */

type ImageLightboxProps = {
  /** Remote or local URIs, in the order they were shown. */
  uris: string[];
  /** Which one to open on. Clamped, so a stale index cannot open on nothing. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
};

export default function ImageLightbox({
  uris,
  initialIndex = 0,
  visible,
  onClose,
}: ImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const safeInitial = Math.min(Math.max(initialIndex, 0), Math.max(uris.length - 1, 0));
  const [index, setIndex] = useState(safeInitial);

  /**
   * Jump to the tapped image without animating, so it is simply there when the
   * modal appears rather than sliding in from whichever one was open last.
   */
  useEffect(() => {
    if (!visible) return;
    setIndex(safeInitial);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: safeInitial * width, animated: false });
    });
  }, [visible, safeInitial, width]);

  if (uris.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            setIndex(Math.min(Math.max(next, 0), uris.length - 1));
          }}
          /** Only meaningful with more than one image; otherwise it just wobbles. */
          scrollEnabled={uris.length > 1}
        >
          {uris.map((uri, i) => (
            <Pressable
              key={`${uri}-${i}`}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close image"
            >
              {/**
                * Tapping the image closes it, which is what people try first.
                * contentFit "contain" so a tall photo is shown whole rather than
                * cropped to the screen, since the point of opening it is to see
                * all of it.
                */}
              <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri }}
                  contentFit="contain"
                  style={{ width, height: height * 0.8 }}
                  transition={120}
                />
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={{ position: 'absolute', top: insets.top + 8, right: 16 }}
        >
          <View
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              borderRadius: MIN_TOUCH_TARGET / 2,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        </Pressable>

        {uris.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              bottom: insets.bottom + 24,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: 'Poppins-Medium',
                fontSize: 13,
                color: 'rgba(255,255,255,0.82)',
                fontVariant: ['tabular-nums'],
              }}
            >
              {index + 1} of {uris.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
