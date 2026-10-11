import { BorderRadius, Colors, useSageHeroPanelMetrics } from '@/lib/designSystem';
import { surfaceElevation } from '@/lib/surfaceStyles';
import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

type SageHeroPanelProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Skip responsive padding (e.g. profile summary with avatar uses custom inner layout). */
  useMetricsPadding?: boolean;
  /** Makes the whole panel a button. Used where the panel represents one thing you can open. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Sage hero shell shared by provider home earnings, wallet balance, and profile panels. */
export function SageHeroPanel({
  children,
  style,
  useMetricsPadding = true,
  onPress,
  accessibilityLabel,
}: SageHeroPanelProps) {
  const { paddingV, paddingH } = useSageHeroPanelMetrics();
  const Container: React.ComponentType<any> = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: Colors.accent,
          borderRadius: BorderRadius.sageHero,
          borderWidth: 1,
          borderColor: Colors.sagePanelBorder,
          overflow: 'hidden',
          position: 'relative',
          elevation: surfaceElevation(2),
          shadowColor: '#1a2414',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        useMetricsPadding ? { paddingVertical: paddingV, paddingHorizontal: paddingH } : null,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -38,
          right: -32,
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: '#FFFFFF',
          opacity: 0.1,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -54,
          left: -42,
          width: 132,
          height: 132,
          borderRadius: 66,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        }}
      />
      {children}
    </Container>
  );
}
