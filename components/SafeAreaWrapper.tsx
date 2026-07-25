import React, { useCallback } from 'react';
import { ViewStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, usePathname } from 'expo-router';
import { PHONE_LANE_OUTER_TOP, useIsTablet } from '@/lib/tabletLayout';
import { applyDefaultStatusBar, applyHandyAiStatusBar, isHandyAiRoute } from '@/utils/statusBar';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** When true on tablet, adds PHONE_LANE_OUTER_TOP under the lane top (no device notch inset). */
  tabletShellTop?: boolean;
}

function tabletEdges(
  edges: SafeAreaWrapperProps['edges'],
  isTablet: boolean
): ('top' | 'bottom' | 'left' | 'right')[] {
  const base = edges ?? ['top', 'bottom'];
  if (!isTablet) return base;
  return base.filter((e) => e !== 'top');
}

export default function SafeAreaWrapper({
  children,
  backgroundColor = '#ffffff',
  style,
  className = '',
  edges,
  tabletShellTop = false,
}: SafeAreaWrapperProps) {
  const isTablet = useIsTablet();
  const pathname = usePathname();
  const resolvedEdges = tabletEdges(edges, isTablet);
  const tabletTopPad = isTablet && tabletShellTop ? PHONE_LANE_OUTER_TOP : 0;

  useFocusEffect(
    useCallback(() => {
      if (isHandyAiRoute(pathname)) {
        applyHandyAiStatusBar();
      } else {
        applyDefaultStatusBar();
      }
    }, [pathname]),
  );

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor, paddingTop: tabletTopPad }, style]} edges={resolvedEdges}>
      {className ? (
        <View className={className} style={{ flex: 1 }}>
          {children}
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
