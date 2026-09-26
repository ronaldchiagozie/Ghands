import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CallEndReason, CallPhase } from '@/hooks/useCallSession';
import { Lock, MessageCircle, Mic, MicOff, Phone, PhoneOff, Volume2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The call screen, shared by the customer and provider apps.
 *
 * Built the way the phone's own call screen is: one dark ground edge to edge,
 * the person in the middle, controls in thumb reach at the bottom. Nothing
 * scrolls, nothing has a header bar, and nothing on it needs reading twice.
 */

const GROUND = '#0E1511';
const INK = '#FFFFFF';
const INK_SOFT = 'rgba(255, 255, 255, 0.72)';
const INK_FAINT = 'rgba(255, 255, 255, 0.45)';
const CONTROL = 'rgba(255, 255, 255, 0.12)';
const ACCEPT = '#34C759';
const END = '#FF3B30';
const ERROR_INK = '#FF9A8F';

export function formatCallTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** The one line under the name. Pure, so every state's wording is tested. */
export function callStatusText(input: {
  phase: CallPhase;
  endReason: CallEndReason | null;
  error: string | null;
  isSettingUp: boolean;
  isInterrupted: boolean;
  duration: number;
}): string {
  const { phase, endReason, error, isSettingUp, isInterrupted, duration } = input;
  switch (phase) {
    case 'incoming':
      return 'Incoming call';
    case 'outgoing':
      return isSettingUp ? 'Calling…' : 'Ringing…';
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return isInterrupted ? 'Reconnecting…' : formatCallTimer(duration);
    case 'ended': {
      if (endReason === 'failed') return error || 'Call failed';
      if (endReason === 'no_answer') return 'No answer';
      if (endReason === 'missed') return 'Missed call';
      if (endReason === 'declined') return 'Call declined';
      if (endReason === 'remote_declined') return 'Declined';
      return duration > 0 ? `Call ended · ${formatCallTimer(duration)}` : 'Call ended';
    }
    default:
      return '';
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function PulseRing({ active, size }: { active: boolean; size: number }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reducedMotion) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reducedMotion, progress]);

  if (!active || reducedMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
}

function RoundButton({
  label,
  onPress,
  icon,
  background,
  size = 64,
  disabled,
  accessibilityState,
}: {
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
  background: string;
  size?: number;
  disabled?: boolean;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
}) {
  /**
   * Press feedback in state, visuals on the inner View: NativeWind drops a
   * Pressable's function style in silence, and these circles would render
   * with no background (see __tests__/pressableStyleFlattening.test.ts).
   */
  const [pressed, setPressed] = useState(false);
  return (
    <View style={{ alignItems: 'center', width: 84, opacity: disabled ? 0.4 : 1 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={accessibilityState}
        hitSlop={8}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: background,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
          }}
        >
          {icon}
        </View>
      </Pressable>
      <Text style={{ marginTop: 8, fontSize: 12.5, fontFamily: 'Poppins-Medium', color: INK_SOFT }}>{label}</Text>
    </View>
  );
}

export type CallViewProps = {
  name: string;
  /** Who they are to this user: "Provider" or "Customer". */
  roleLabel: string;
  avatarUri?: string | null;
  jobTitle?: string | null;
  phase: CallPhase;
  endReason: CallEndReason | null;
  error: string | null;
  isSettingUp: boolean;
  isInterrupted: boolean;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  canSwitchSpeaker: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onCallAgain: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onMessage?: () => void;
  onClose: () => void;
};

export function CallView(props: CallViewProps) {
  const insets = useSafeAreaInsets();
  const { phase, endReason, name, roleLabel, avatarUri, jobTitle } = props;
  const status = callStatusText(props);
  const isRinging = phase === 'incoming' || phase === 'outgoing';
  const isLive = phase === 'outgoing' || phase === 'connecting' || phase === 'active';
  const statusIsError = phase === 'ended' && endReason === 'failed';
  const AVATAR = 132;

  return (
    <View style={{ flex: 1, backgroundColor: GROUND, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <StatusBar barStyle="light-content" />

      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        {phase === 'ended' ? (
          <Pressable
            onPress={props.onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={{ position: 'absolute', left: 16 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CONTROL, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={INK} strokeWidth={2.2} />
            </View>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Lock size={12} color={INK_FAINT} strokeWidth={2.4} />
          <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: INK_FAINT, letterSpacing: 0.2 }}>
            GHands voice call
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: AVATAR * 1.5, height: AVATAR * 1.5, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing active={isRinging} size={AVATAR} />
          <View
            style={{
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR / 2,
              backgroundColor: CONTROL,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: AVATAR, height: AVATAR }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 44, fontFamily: 'Poppins-SemiBold', color: INK }}>{initialsOf(name)}</Text>
            )}
          </View>
        </View>

        <Text
          style={{ marginTop: 12, fontSize: 30, fontFamily: 'Poppins-SemiBold', color: INK, textAlign: 'center', letterSpacing: -0.4 }}
          numberOfLines={2}
        >
          {name}
        </Text>

        <Text
          accessibilityLiveRegion="polite"
          style={{
            marginTop: 6,
            fontSize: 16,
            fontFamily: 'Poppins-Medium',
            color: statusIsError ? ERROR_INK : INK_SOFT,
            textAlign: 'center',
            maxWidth: 300,
            fontVariant: ['tabular-nums'],
          }}
        >
          {status}
        </Text>

        <View
          style={{
            marginTop: 18,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            maxWidth: '100%',
          }}
        >
          <Text style={{ fontSize: 12.5, fontFamily: 'Poppins-Medium', color: INK_SOFT }} numberOfLines={1}>
            {jobTitle ? `${roleLabel} · ${jobTitle}` : roleLabel}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        {phase === 'incoming' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, marginBottom: 12 }}>
            <RoundButton
              label="Decline"
              onPress={props.onDecline}
              background={END}
              size={74}
              icon={<PhoneOff size={30} color={INK} strokeWidth={2.2} />}
            />
            <RoundButton
              label="Accept"
              onPress={props.onAnswer}
              background={ACCEPT}
              size={74}
              icon={<Phone size={30} color={INK} strokeWidth={2.2} />}
            />
          </View>
        ) : null}

        {isLive ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 }}>
              <RoundButton
                label="Speaker"
                onPress={props.onToggleSpeaker}
                disabled={!props.canSwitchSpeaker}
                accessibilityState={{ selected: props.isSpeakerOn, disabled: !props.canSwitchSpeaker }}
                background={props.isSpeakerOn ? INK : CONTROL}
                icon={<Volume2 size={26} color={props.isSpeakerOn ? GROUND : INK} strokeWidth={2} />}
              />
              <RoundButton
                label={props.isMuted ? 'Unmute' : 'Mute'}
                onPress={props.onToggleMute}
                accessibilityState={{ selected: props.isMuted }}
                background={props.isMuted ? INK : CONTROL}
                icon={props.isMuted ? <MicOff size={26} color={GROUND} strokeWidth={2} /> : <Mic size={26} color={INK} strokeWidth={2} />}
              />
              <RoundButton
                label="Message"
                onPress={props.onMessage ?? (() => undefined)}
                disabled={!props.onMessage}
                background={CONTROL}
                icon={<MessageCircle size={26} color={INK} strokeWidth={2} />}
              />
            </View>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <RoundButton
                label="End"
                onPress={props.onHangUp}
                background={END}
                size={74}
                icon={<PhoneOff size={30} color={INK} strokeWidth={2.2} />}
              />
            </View>
          </>
        ) : null}

        {phase === 'ended' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, marginBottom: 12 }}>
            {props.onMessage ? (
              <RoundButton
                label="Message"
                onPress={props.onMessage}
                background={CONTROL}
                size={68}
                icon={<MessageCircle size={28} color={INK} strokeWidth={2} />}
              />
            ) : null}
            <RoundButton
              label="Call again"
              onPress={props.onCallAgain}
              background={ACCEPT}
              size={68}
              icon={<Phone size={28} color={INK} strokeWidth={2.2} />}
            />
          </View>
        ) : null}

        <Text style={{ textAlign: 'center', fontSize: 11.5, fontFamily: 'Poppins-Regular', color: INK_FAINT, marginTop: 4 }}>
          Calls stay inside the GHands app
        </Text>
      </View>
    </View>
  );
}
