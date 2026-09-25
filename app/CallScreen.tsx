import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import {
  CallActionButton,
  CallJobSummaryCard,
  CallPulseRing,
  CallStatusPill,
  mapCallAudioMessage,
} from '@/components/call/CallUiParts';
import {
  CallIconAnswer,
  CallIconEnd,
  CallIconMessage,
  CallIconMic,
  CallIconMicOff,
  CallIconSpeaker,
} from '@/components/call/CallIcons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Shield,
  User,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { haptics } from '@/hooks/useHaptics';
import { useVoiceCallWebRtc } from '@/hooks/useVoiceCallWebRtc';
import { communicationService } from '@/services/api';
import { logCallDebug, logCallError, logCallWarn, serializeCallApiError } from '@/utils/callDebugLog';
import {
  isWebRtcNativeAvailable,
  WEBRTC_UNAVAILABLE_MESSAGE,
} from '@/utils/webrtcAvailability';
import { buildChatScreenParams, exitChatToJobHub } from '@/utils/navigation';
import ToolPattern from '@/components/ToolPattern';

export type CallState = 'incoming' | 'outgoing' | 'active' | 'ended';

interface CallScreenParams {
  callState?: CallState;
  callerName?: string;
  callerId?: string;
  callerImage?: string;
  jobTitle?: string;
  jobDescription?: string;
  orderNumber?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  jobStatus?: string;
  requestId?: string;
  isProvider?: string;
}

function resolveJobTitle(params: CallScreenParams): string {
  const title = params.jobTitle?.trim();
  if (title && title !== 'Service Request') return title;
  return 'Your service job';
}

function resolveJobSubtitle(params: CallScreenParams): string | undefined {
  const parts: string[] = [];
  const location = params.location?.trim();
  if (location) parts.push(location);
  const when = [params.scheduledDate?.trim(), params.scheduledTime?.trim()].filter(Boolean).join(' · ');
  if (when) parts.push(when);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * The call ground: deep sage into near-black.
 *
 * Not grey, and not the page white this screen used to sit on. A call is the
 * one place in the app where the interface should get out of the way, and a
 * dark ground is what every phone does for exactly that reason.
 */
const CALL_GROUND = '#22301A';
const CALL_INK = '#FFFFFF';
const CALL_INK_SOFT = 'rgba(255, 255, 255, 0.66)';

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as unknown as CallScreenParams;

  const initialCallState: CallState = (params.callState as CallState) || 'incoming';
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [callReference, setCallReference] = useState<string | null>(null);
  const [isCreatingCall, setIsCreatingCall] = useState(false);
  const [callSetupError, setCallSetupError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isProvider] = useState(params.isProvider === 'true');

  const voice = useVoiceCallWebRtc();
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdNum = params.requestId ? parseInt(params.requestId, 10) : null;
  const hasRequestId = requestIdNum !== null && !isNaN(requestIdNum);

  const jobTitle = resolveJobTitle(params);
  const jobSubtitle = resolveJobSubtitle(params);
  const callerName =
    params.callerName?.trim() ||
    (isProvider ? 'Client' : 'Provider');
  const callerImage = params.callerImage?.trim() || null;
  const peerRole = isProvider ? 'Client' : 'Provider';

  const isRinging = callState === 'incoming' || (callState === 'outgoing' && !callSetupError && !isCreatingCall);
  const audioMessage = mapCallAudioMessage(voice.error, voice.status);

  const headerTitle =
    callState === 'incoming'
      ? 'Incoming call'
      : callState === 'outgoing'
        ? 'Calling'
        : callState === 'active'
          ? 'On call'
          : 'Call ended';

  const statusPillLabel =
    callState === 'incoming'
      ? 'Ringing'
      : callState === 'outgoing'
        ? isCreatingCall
          ? 'Connecting'
          : callSetupError
            ? 'Unavailable'
            : 'Ringing'
        : callState === 'active'
          ? formatDuration(callDuration)
          : `Ended · ${formatDuration(callDuration)}`;

  const statusPillTone =
    callState === 'active'
      ? 'active'
      : callSetupError || voice.error
        ? 'error'
        : callState === 'ended'
          ? 'neutral'
          : 'warning';

  const statusLine =
    callState === 'incoming'
      ? `${peerRole} is calling about your job`
      : callState === 'outgoing'
        ? callSetupError
          ? mapCallAudioMessage(callSetupError, 'failed')
          : isCreatingCall
            ? 'Setting up secure voice…'
            : `Calling ${callerName}…`
        : callState === 'active'
          ? audioMessage || 'You are connected'
          : 'Call finished';

  useEffect(() => {
    logCallDebug('CallScreen mounted', {
      callState: initialCallState,
      requestIdParam: params.requestId,
      webrtcAvailable: isWebRtcNativeAvailable(),
    });
    if (!isWebRtcNativeAvailable()) {
      setCallSetupError(WEBRTC_UNAVAILABLE_MESSAGE);
    }
  }, []);

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    if (callState === 'active') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [callState]);

  useEffect(() => {
    if (callState !== 'outgoing' || !hasRequestId || callId) return;

    setIsCreatingCall(true);
    setCallSetupError(null);
    communicationService
      .initiateCall(requestIdNum!)
      .then(async ({ callId: id, callReference: ref }) => {
        setCallId(id || null);
        setCallReference(ref || null);
        if (id) {
          try {
            await communicationService.updateCallStatus(id, 'ringing');
          } catch (ringErr) {
            logCallWarn('CallScreen: updateCallStatus(ringing) failed', serializeCallApiError(ringErr));
          }
        }
      })
      .catch((err) => {
        const serialized = serializeCallApiError(err);
        logCallError('CallScreen: initiateCall failed', { requestId: requestIdNum, ...serialized });
        setCallSetupError(
          typeof serialized.message === 'string'
            ? serialized.message
            : 'Could not start the call. Please try again.',
        );
      })
      .finally(() => setIsCreatingCall(false));
  }, [callState, hasRequestId, requestIdNum, callId]);

  useEffect(() => {
    if (!callReference || callState === 'ended') {
      voice.stop();
      return;
    }
    if (!isWebRtcNativeAvailable()) return;
    if (callState === 'outgoing' || callState === 'active') {
      voice.start(callReference);
    }
    return () => voice.stop();
  }, [callReference, callState, voice.start, voice.stop]);

  useEffect(() => {
    voice.setMuted(isMuted);
  }, [isMuted, voice.setMuted]);

  const updateStatus = useCallback(async (status: string) => {
    if (!callId) return;
    try {
      await communicationService.updateCallStatus(callId, status);
    } catch (err) {
      logCallError('CallScreen: updateCallStatus error', { callId, status, ...serializeCallApiError(err) });
    }
  }, [callId]);

  const handleAcceptCall = () => {
    haptics.success();
    updateStatus('connected');
    setCallState('active');
    setCallDuration(0);
  };

  const handleDeclineCall = () => {
    haptics.error();
    voice.stop();
    updateStatus('ended');
    setCallState('ended');
  };

  const handleEndCall = () => {
    haptics.error();
    voice.stop();
    updateStatus('ended');
    setCallState('ended');
  };

  const handleCallAgain = () => {
    haptics.light();
    voice.stop();
    setCallId(null);
    setCallReference(null);
    setCallSetupError(isWebRtcNativeAvailable() ? null : WEBRTC_UNAVAILABLE_MESSAGE);
    setCallState('outgoing');
    setCallDuration(0);
  };

  const handleMessage = () => {
    haptics.light();
    if (!params.requestId) return;
    router.push({
      pathname: '/ChatScreen',
      params: buildChatScreenParams({
        providerName: isProvider ? undefined : callerName,
        clientName: isProvider ? callerName : undefined,
        providerId: params.callerId,
        requestId: params.requestId,
        fromJobHub: true,
      }),
    } as any);
  };

  const handleViewJob = () => {
    haptics.light();
    if (!params.requestId) {
      router.back();
      return;
    }
    exitChatToJobHub(router, {
      requestId: params.requestId,
      isProvider,
      fromJobHub: '1',
    });
  };

  const showJobSummary = callState === 'ended';
  const showCompactJobLine = callState !== 'ended' && Boolean(params.requestId);

  return (
    <SafeAreaWrapper backgroundColor={CALL_GROUND}>
      <View style={{ flex: 1, backgroundColor: CALL_GROUND }}>
        {/**
          * Dark, and full bleed.
          *
          * This was a white screen with a scroll view on it - the same
          * treatment as a settings form. A live call is not a form: it is one
          * person, one timer and two buttons, and every phone anybody owns
          * renders that on a dark immersive ground because the screen is
          * ambient rather than something being read.
          *
          * One flat green, not a gradient to near-black. The fade used to put
          * a visibly darker tone behind the pulsing ring than the ring itself,
          * which read as two different greens rather than one screen.
          */}
        {/**
          * A call screen is mostly empty by nature - a name, a timer, and a
          * long wait. The pattern gives that emptiness something to be, the
          * way a messaging app puts one behind a conversation, and it is the
          * trades this app books rather than wallpaper that could sit
          * anywhere.
          *
          * Fainter than the receipt. Somebody stares at this screen for the
          * length of a phone call, and a texture that is pleasant for two
          * seconds is tiring for two minutes.
          */}
        <ToolPattern color={CALL_INK} opacity={0.05} tile={200} />
        {(callState === 'ended' || callState === 'outgoing') && (
          <ScreenHeader
            title={headerTitle}
            onBack={() => {
              haptics.light();
              if (callState === 'outgoing' && !isCreatingCall) {
                handleEndCall();
              } else {
                router.back();
              }
            }}
            backgroundColor={Colors.backgroundLight}
          />
        )}

        {callState === 'incoming' || callState === 'active' ? (
          <View style={{ alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm }}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {headerTitle}
            </Text>
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Spacing.lg,
          }}
        >
          <View style={{ alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
            <CallStatusPill label={statusPillLabel} tone={statusPillTone} />

            <View
              style={{
                marginTop: Spacing.xl,
                alignItems: 'center',
                justifyContent: 'center',
                width: 168,
                height: 168,
              }}
            >
              <CallPulseRing active={isRinging} size={132} />
              <View
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: callState === 'active' ? '#A3C47F' : 'rgba(255, 255, 255, 0.22)',
                  overflow: 'hidden',
                }}
              >
                {callerImage ? (
                  <Image
                    source={{ uri: callerImage }}
                    style={{ width: 132, height: 132 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: BorderRadius.full,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <User size={40} color={CALL_INK} />
                  </View>
                )}
              </View>
            </View>

            <Text
              style={{
                marginTop: Spacing.lg,
                fontSize: 27,
                fontFamily: 'Poppins-Bold',
                color: CALL_INK,
                textAlign: 'center',
                letterSpacing: -0.3,
              }}
              numberOfLines={2}
            >
              {callerName}
            </Text>

            <Text
              style={{
                marginTop: 4,
                fontSize: 13.5,
                fontFamily: 'Poppins-Medium',
                color: CALL_INK_SOFT,
                letterSpacing: 0.2,
              }}
            >
              {peerRole}
            </Text>

            <Text
              style={{
                marginTop: Spacing.md,
                fontSize: 15,
                fontFamily: 'Poppins-Regular',
                color: callSetupError || voice.error ? '#FF9A8A' : CALL_INK_SOFT,
                textAlign: 'center',
                lineHeight: 22,
                maxWidth: 300,
                /** The timer lives here; digits must not shift as it counts. */
                fontVariant: ['tabular-nums'],
              }}
            >
              {statusLine}
            </Text>

            {showCompactJobLine ? (
              <View
                style={{
                  marginTop: Spacing.lg,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.14)',
                  maxWidth: '100%',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Medium',
                    color: CALL_INK_SOFT,
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  {jobTitle}
                  {params.requestId ? ` · #${params.requestId}` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {showJobSummary ? (
            <CallJobSummaryCard
              title={jobTitle}
              subtitle={jobSubtitle}
              requestId={params.requestId}
              onViewJob={handleViewJob}
            />
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md }}>
          {callState === 'incoming' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 48 }}>
              <CallActionButton
                label="Decline"
                variant="danger"
                onPress={handleDeclineCall}
                icon={<CallIconEnd size={28} color={Colors.white} />}
              />
              <CallActionButton
                label="Answer"
                variant="primary"
                onPress={handleAcceptCall}
                icon={<CallIconAnswer size={28} color={Colors.white} />}
              />
            </View>
          ) : null}

          {callState === 'outgoing' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 28 }}>
              <CallActionButton
                label="Cancel"
                variant="danger"
                disabled={isCreatingCall}
                onPress={handleEndCall}
                icon={<CallIconEnd size={28} color={Colors.white} />}
              />
              {callSetupError ? (
                <CallActionButton
                  label="Try again"
                  variant="secondary"
                  onPress={handleCallAgain}
                  icon={<CallIconAnswer size={22} color={Colors.accent} />}
                />
              ) : null}
            </View>
          ) : null}

          {callState === 'active' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, alignItems: 'flex-start' }}>
              <CallActionButton
                label={isMuted ? 'Unmute' : 'Mute'}
                variant="secondary"
                onPress={() => {
                  haptics.light();
                  setIsMuted((prev) => !prev);
                }}
                icon={
                  isMuted ? (
                    <CallIconMicOff size={22} color={Colors.textPrimary} />
                  ) : (
                    <CallIconMic size={22} color={Colors.textPrimary} />
                  )
                }
              />
              <CallActionButton
                label="End"
                variant="danger"
                onPress={handleEndCall}
                icon={<CallIconEnd size={28} color={Colors.white} />}
              />
              <CallActionButton
                label="Speaker"
                variant="secondary"
                onPress={() => {
                  haptics.light();
                  setIsSpeakerOn((prev) => !prev);
                }}
                icon={
                  <CallIconSpeaker
                    size={22}
                    color={isSpeakerOn ? Colors.accent : Colors.textPrimary}
                    active={isSpeakerOn}
                  />
                }
              />
            </View>
          ) : null}

          {callState === 'ended' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 40 }}>
              <CallActionButton
                label="Message"
                variant="secondary"
                onPress={handleMessage}
                icon={<CallIconMessage size={22} color={Colors.accent} />}
              />
              <CallActionButton
                label="Call again"
                variant="secondary"
                onPress={handleCallAgain}
                icon={<CallIconAnswer size={22} color={Colors.accent} />}
              />
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: Spacing.lg,
              gap: 6,
            }}
          >
            <Shield size={14} color={Colors.textSecondaryDark} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
                flexShrink: 1,
              }}
            >
              GHands secure voice · recorded for quality and disputes
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
