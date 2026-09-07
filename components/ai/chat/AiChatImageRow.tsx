import { useReducedMotion } from '@/hooks/useReducedMotion';
import { runSpring, runTiming } from '@/lib/motion';
import { Image as ImageIcon, Images, User } from 'lucide-react-native';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import ImageLightbox from '@/components/ImageLightbox';
import type { AiImageAttachment } from './types';

const TILE_SIZE = 76;
const TILE_RADIUS = 16;
const TILE_BG = '#B8BFC9';

type AiChatImageRowProps = {
  items: AiImageAttachment[];
  extraCount?: number;
  visible: boolean;
};

function LoadingRing() {
  const reducedMotion = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 44,
        height: 44,
        transform: reducedMotion ? undefined : [{ rotate }],
      }}
    >
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Circle
          cx={22}
          cy={22}
          r={18}
          stroke="rgba(255, 255, 255, 0.95)"
          strokeWidth={2.5}
          fill="none"
          strokeDasharray="36 78"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function AiChatImageTile({
  item,
  index,
  onPress,
}: {
  item: AiImageAttachment;
  index: number;
  onPress?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 8)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    runTiming(reducedMotion, opacity, {
      toValue: 1,
      duration: 280,
      delay: index * 80,
      useNativeDriver: true,
    });
    runSpring(reducedMotion, translateY, {
      toValue: 0,
      delay: index * 80,
      tension: 90,
      friction: 14,
      useNativeDriver: true,
    });
  }, [index, opacity, reducedMotion, translateY]);

  const showLoading = Boolean(item.loading);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {/**
        * Tappable once it has actually loaded. A 76px tile is enough to know a
        * photo is there and not enough to see what is in it, and the whole
        * reason somebody sends Handy a picture of a leak is so it can be looked
        * at.
        */}
      <Pressable
        onPress={showLoading ? undefined : onPress}
        disabled={showLoading || !onPress}
        accessibilityRole={onPress ? 'imagebutton' : undefined}
        accessibilityLabel={onPress ? 'View photo' : undefined}
      >
      <View
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          borderRadius: TILE_RADIUS,
          backgroundColor: TILE_BG,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {showLoading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <LoadingRing />
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ImageIcon size={15} color="#9CA3AF" strokeWidth={2} />
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: item.uri }}
            contentFit="cover"
            style={{ width: TILE_SIZE, height: TILE_SIZE }}
          />
        )}
      </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AiChatImageRow({
  items,
  extraCount = 0,
  visible,
}: AiChatImageRowProps) {
  const reducedMotion = useReducedMotion();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const containerOpacity = useRef(new Animated.Value(reducedMotion || visible ? 1 : 0)).current;
  const containerTranslateY = useRef(new Animated.Value(reducedMotion || visible ? 0 : 12)).current;

  useEffect(() => {
    if (!visible) {
      containerOpacity.setValue(0);
      containerTranslateY.setValue(12);
      return;
    }

    if (reducedMotion) {
      containerOpacity.setValue(1);
      containerTranslateY.setValue(0);
      return;
    }

    runTiming(reducedMotion, containerOpacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    });
    runSpring(reducedMotion, containerTranslateY, {
      toValue: 0,
      tension: 84,
      friction: 14,
      useNativeDriver: true,
    });
  }, [containerOpacity, containerTranslateY, reducedMotion, visible]);

  /**
   * Only loaded images can be opened, and the viewer is indexed against that
   * same list so tapping the third tile does not open the second picture when
   * one of them is still uploading.
   */
  const viewableUris = items
    .filter((item): item is AiImageAttachment & { uri: string } =>
      !item.loading && typeof item.uri === 'string' && item.uri.trim().length > 0,
    )
    .map((item) => item.uri);
  const openViewerAt = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.loading || !target.uri) return;
    setViewerIndex(Math.max(viewableUris.indexOf(target.uri), 0));
    setViewerOpen(true);
  };

  if (!visible || items.length === 0) return null;

  return (
    <Animated.View
      style={{
        opacity: containerOpacity,
        transform: [{ translateY: containerTranslateY }],
        marginBottom: 18,
        alignItems: 'flex-end',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '92%' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {items.map((item, index) => (
              <View key={item.id} style={{ position: 'relative', marginLeft: 10 }}>
                <AiChatImageTile
                  item={item}
                  index={index}
                  onPress={() => openViewerAt(item.id)}
                />
                {index === 1 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -10,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: 'rgba(255, 255, 255, 0.92)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Images size={12} color="#374151" strokeWidth={2.2} />
                  </View>
                ) : null}
              </View>
            ))}
            {extraCount > 0 ? (
              <Text
                style={{
                  fontFamily: 'Poppins-Medium',
                  fontSize: 13,
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginLeft: 8,
                }}
              >
                +{extraCount} more
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 10,
          }}
        >
          <User size={16} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </View>

      <ImageLightbox
        uris={viewableUris}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </Animated.View>
  );
}
