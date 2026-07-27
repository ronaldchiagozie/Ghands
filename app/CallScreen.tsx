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
  if (location && !/service location|123 main/i.test(location)) parts.push(location);
  const when = [params.scheduledDate?.trim(), params.scheduledTime?.trim()].filter(Boolean).join(' · ');
  if (when && !/oct 20, 2024/i.test(when)) parts.push(when);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

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
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <View style={{ flex: 1, backgroundColor: Colors.backgroundLight }}>
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
                width: 140,
                height: 140,
              }}
            >
              <CallPulseRing active={isRinging} size={112} />
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  backgroundColor: Colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: callState === 'active' ? Colors.accent : 'rgba(79, 103, 57, 0.2)',
                  overflow: 'hidden',
                }}
              >
                {callerImage ? (
                  <Image
                    source={{ uri: callerImage }}
                    style={{ width: 112, height: 112 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: BorderRadius.full,
                      backgroundColor: Colors.sageTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <User size={34} color={Colors.accent} />
                  </View>
                )}
              </View>
            </View>

            <Text
              style={{
                marginTop: Spacing.lg,
                fontSize: 24,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
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
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              {peerRole}
            </Text>

            <Text
              style={{
                marginTop: Spacing.md,
                fontSize: 15,
                fontFamily: 'Poppins-Regular',
                color: callSetupError || voice.error ? Colors.error : Colors.textSecondaryDark,
                textAlign: 'center',
                lineHeight: 22,
                maxWidth: 300,
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
                  backgroundColor: Colors.white,
                  borderWidth: 1,
                  borderColor: 'rgba(79, 103, 57, 0.12)',
                  maxWidth: '100%',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.accent,
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
            <View style={{ alignItems: 'center', gap: Spacing.md }}>
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
                  style={{ marginTop: 4 }}
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
