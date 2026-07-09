import { Colors, MIN_TOUCH_TARGET, SHADOWS, Spacing } from '@/lib/designSystem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View, type ViewStyle } from 'react-native';

type CallPulseRingProps = {
  active: boolean;
  size?: number;
};

export function CallPulseRing({ active, size = 112 }: CallPulseRingProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reducedMotion) {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse, reducedMotion]);

  if (!active || reducedMotion) return null;

  const ringSize = size + 28;

  return (
    <>
      {[0, 1].map((index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: 2,
            borderColor: 'rgba(79, 103, 57, 0.28)',
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.45 - index * 0.15, 0],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.22 + index * 0.08],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  );
}

type CallActionButtonProps = {
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
};

export function CallActionButton({
  label,
  onPress,
  icon,
  variant = 'secondary',
  disabled = false,
  style,
}: CallActionButtonProps) {
  const bg =
    variant === 'danger'
      ? Colors.errorBright
      : variant === 'primary'
        ? Colors.accent
        : Colors.white;
  const borderColor =
    variant === 'secondary' ? 'rgba(17, 24, 39, 0.08)' : 'transparent';
  const size = variant === 'danger' || variant === 'primary' ? 68 : 56;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        { alignItems: 'center', opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...(variant === 'danger' ? SHADOWS.md : SHADOWS.sm),
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          marginTop: 8,
          fontSize: 12,
          fontFamily: 'Poppins-Medium',
          color: Colors.textSecondaryDark,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CallStatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'active' | 'warning' | 'error';
}) {
  const styles = {
    neutral: { bg: Colors.white, text: Colors.textSecondaryDark, border: 'rgba(17, 24, 39, 0.08)' },
    active: { bg: '#ECFDF3', text: '#047857', border: 'rgba(4, 120, 87, 0.14)' },
    warning: { bg: '#FFF7DF', text: Colors.warningForeground, border: 'rgba(180, 120, 0, 0.12)' },
    error: { bg: '#FEF2F2', text: Colors.error, border: 'rgba(220, 38, 38, 0.12)' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: styles.bg,
        borderWidth: 1,
        borderColor: styles.border,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: styles.text }}>{label}</Text>
    </View>
  );
}

export function CallJobSummaryCard({
  title,
  subtitle,
  requestId,
  onViewJob,
}: {
  title: string;
  subtitle?: string;
  requestId?: string;
  onViewJob?: () => void;
}) {
  return (
    <View
      style={{
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.06)',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.textSecondaryDark,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 6,
        }}
      >
        Related job
      </Text>
      <Text
        style={{ fontSize: 16, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, lineHeight: 22 }}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: 4,
            fontSize: 13,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
            lineHeight: 19,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
      {requestId ? (
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            fontFamily: 'Poppins-Medium',
            color: Colors.accent,
          }}
        >
          Job #{requestId}
        </Text>
      ) : null}
      {onViewJob ? (
        <Pressable
          onPress={onViewJob}
          style={({ pressed }) => ({
            marginTop: Spacing.md,
            alignSelf: 'flex-start',
            backgroundColor: Colors.accent,
            paddingHorizontal: Spacing.lg,
            paddingVertical: 10,
            borderRadius: 12,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
            View job
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function mapCallAudioMessage(error: string | null, status: string): string | null {
  if (error) {
    if (/development build|expo go|webrtc/i.test(error)) {
      return 'In-app voice is only available in the installed app, not Expo Go.';
    }
    return 'Voice connection unavailable. You can still message your provider.';
  }
  if (status === 'starting') return 'Connecting secure voice…';
  if (status === 'connected') return 'Secure in-app voice';
  return null;
}
