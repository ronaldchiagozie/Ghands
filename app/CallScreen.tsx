import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors, Spacing, BorderRadius, SHADOWS } from '@/lib/designSystem';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, PhoneOff, Mic, MicOff, Volume2, Shield, User, Calendar, MapPin, Hash, MessageCircle } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { haptics } from '@/hooks/useHaptics';
import { useVoiceCallWebRtc } from '@/hooks/useVoiceCallWebRtc';
import { communicationService } from '@/services/api';
import { logCallDebug, logCallError, logCallWarn, serializeCallApiError } from '@/utils/callDebugLog';

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
  isProvider?: string; // 'true' or 'false'
}

interface JobDetails {
  title: string;
  description: string;
  orderNumber: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: string;
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as unknown as CallScreenParams;
  
  // Parse call state from params
  const initialCallState: CallState = (params.callState as CallState) || 'incoming';
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [callDuration, setCallDuration] = useState(0); // in seconds
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

  // Job details from params
  const jobDetails: JobDetails = {
    title: params.jobTitle || 'Plumbing Repair',
    description: params.jobDescription || 'Kitchen pipe leak repair',
    orderNumber: params.orderNumber || '#WO-2024-1157',
    scheduledDate: params.scheduledDate || 'Oct 20, 2024',
    scheduledTime: params.scheduledTime || '2:00 PM',
    location: params.location || '123 Main St, Downtown',
    status: params.jobStatus || 'In Progress',
  };

  const callerName = params.callerName || (isProvider ? 'JohnDoe Akpan' : 'AquaFix Solutions');
  const callerImage = params.callerImage;
  const statusLabel =
    callState === 'incoming'
      ? 'Incoming call'
      : callState === 'outgoing'
        ? isCreatingCall
          ? 'Starting secure call'
          : callSetupError
            ? 'Call failed'
            : 'Ringing'
        : callState === 'active'
          ? 'Connected'
          : 'Call ended';
  const statusColor =
    callState === 'active'
      ? '#047857'
      : callState === 'ended' || callSetupError
        ? Colors.error
        : Colors.warningForeground;
  const statusBg =
    callState === 'active'
      ? '#ECFDF3'
      : callState === 'ended' || callSetupError
        ? '#FEF2F2'
        : '#FFF7DF';

  useEffect(() => {
    logCallDebug('CallScreen mounted', {
      callState: initialCallState,
      requestIdParam: params.requestId,
      requestIdParsed: requestIdNum,
      hasRequestId,
      isProvider: params.isProvider,
      callerName: params.callerName,
      callerId: params.callerId,
    });
  }, []);

  // Format call duration (HH:MM:SS)
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start call duration timer
  useEffect(() => {
    if (callState === 'active') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState]);

  // Initiate call via API when outgoing and we have requestId
  useEffect(() => {
    if (callState === 'outgoing' && hasRequestId && !callId) {
      logCallDebug('CallScreen: auto initiate branch', { callState, requestId: requestIdNum });
      setIsCreatingCall(true);
      setCallSetupError(null);
      communicationService
        .initiateCall(requestIdNum!)
        .then(async ({ callId: id, callReference: ref }) => {
          setCallId(id || null);
          setCallReference(ref || null);
          logCallDebug('CallScreen: initiateCall state updated', { localCallId: id || null, callReference: ref || null });
          if (id) {
            try {
              await communicationService.updateCallStatus(id, 'ringing');
              logCallDebug('CallScreen: initial ringing status sent', { callId: id });
            } catch (ringErr) {
              logCallWarn('CallScreen: updateCallStatus(ringing) failed after create', {
                callId: id,
                ...serializeCallApiError(ringErr),
              });
            }
          } else {
            logCallWarn('CallScreen: skipping ringing PATCH — no callId from API', { requestId: requestIdNum });
          }
        })
        .catch((err) => {
          const serialized = serializeCallApiError(err);
          logCallError('CallScreen: initiateCall failed', { requestId: requestIdNum, ...serialized });
          const msg = typeof serialized.message === 'string' ? serialized.message : 'Could not start call. Please try again.';
          setCallSetupError(msg.length > 160 ? `${msg.slice(0, 160)}…` : msg);
        })
        .finally(() => {
          setIsCreatingCall(false);
        });
    }
    if (callState === 'outgoing' && !hasRequestId) {
      logCallWarn('CallScreen: outgoing but missing/invalid requestId — API will not run', {
        requestIdParam: params.requestId,
        requestIdParsed: requestIdNum,
      });
    }
  }, [callState, hasRequestId, requestIdNum, callId]);

  // In-app WebRTC voice when we have a call reference (native dev / release builds)
  useEffect(() => {
    if (!callReference || callState === 'ended') {
      voice.stop();
      return;
    }
    if (callState === 'outgoing' || callState === 'active') {
      voice.start(callReference);
    }
    return () => {
      voice.stop();
    };
  }, [callReference, callState, voice.start, voice.stop]);

  useEffect(() => {
    voice.setMuted(isMuted);
  }, [isMuted, voice.setMuted]);

  const updateStatus = useCallback(async (status: string) => {
    if (!callId) {
      logCallWarn('updateCallStatus skipped: no callId on device yet', { status });
      return;
    }
    try {
      await communicationService.updateCallStatus(callId, status);
    } catch (err) {
      logCallError('CallScreen: updateCallStatus error', { callId, status, ...serializeCallApiError(err) });
    }
  }, [callId]);

  const handleAcceptCall = () => {
    logCallDebug('CallScreen: user accepted (incoming → active)', { callId, priorState: callState });
    haptics.success();
    updateStatus('connected');
    setCallState('active');
    setCallDuration(0);
  };

  const handleDeclineCall = () => {
    logCallDebug('CallScreen: user declined', { callId, priorState: callState });
    haptics.error();
    voice.stop();
    updateStatus('ended');
    setCallState('ended');
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const handleEndCall = () => {
    logCallDebug('CallScreen: user ended call', { callId, priorState: callState });
    haptics.error();
    voice.stop();
    updateStatus('ended');
    setCallState('ended');
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const handleToggleMute = () => {
    haptics.light();
    setIsMuted((prev) => !prev);
  };

  const handleToggleSpeaker = () => {
    haptics.light();
    setIsSpeakerOn(!isSpeakerOn);
  };

  const handleCallAgain = () => {
    logCallDebug('CallScreen: call again (reset outgoing)', { hadCallId: callId });
    haptics.light();
    voice.stop();
    setCallId(null);
    setCallReference(null);
    setCallSetupError(null);
    setCallState('outgoing');
    setCallDuration(0);
  };

  const handleMessage = () => {
    haptics.light();
    router.push({
      pathname: '/ChatScreen',
      params: {
        providerName: isProvider ? undefined : callerName,
        clientName: isProvider ? callerName : undefined,
        providerId: params.callerId,
        requestId: params.requestId,
      },
    } as any);
  };

  const handleCheckUpdates = () => {
    haptics.light();
    if (params.requestId) {
      router.push({
        pathname: isProvider ? '/ProviderJobDetailsScreen' : '/OngoingJobDetails',
        params: {
          requestId: params.requestId,
        },
      } as any);
    } else {
      router.back();
    }
  };

  // Job Details Card Component
  const JobDetailsCard = () => (
    <View
      style={{
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 16,
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(17, 24, 39, 0.045)',
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.035,
        shadowRadius: 10,
        elevation: 0.76,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
        <Text
          style={{
            fontSize: 18,
            fontFamily: 'Poppins-Bold',
            color: Colors.textPrimary,
            flex: 1,
            lineHeight: 24,
          }}
          numberOfLines={2}
        >
          {jobDetails.title}
        </Text>
        <View
          style={{
            backgroundColor: Colors.statusPendingAltBg,
            paddingHorizontal: Spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: 999,
            marginLeft: Spacing.sm,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.warningForeground,
            }}
          >
            {jobDetails.status}
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontSize: 14,
          fontFamily: 'Poppins-Regular',
          color: Colors.textSecondaryDark,
          marginBottom: Spacing.md,
          lineHeight: 20,
        }}
        numberOfLines={2}
      >
        {jobDetails.description}
      </Text>

      <View style={{ gap: Spacing.sm, marginTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Calendar size={15} color={Colors.textSecondaryDark} style={{ marginRight: Spacing.sm }} />
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
            }}
          >
            {jobDetails.scheduledDate} • {jobDetails.scheduledTime}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MapPin size={15} color={Colors.textSecondaryDark} style={{ marginRight: Spacing.sm }} />
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {jobDetails.location}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Hash size={15} color={Colors.textSecondaryDark} style={{ marginRight: Spacing.sm }} />
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
            }}
          >
            {jobDetails.orderNumber}
          </Text>
        </View>
      </View>
      {callState === 'ended' && (
        <TouchableOpacity
          onPress={handleCheckUpdates}
          activeOpacity={0.8}
          style={{
            marginTop: Spacing.lg,
            alignSelf: 'center',
            backgroundColor: Colors.textPrimary,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.default,
          }}
        >
          <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
            Check updates
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <View style={{ flex: 1, backgroundColor: Colors.backgroundLight }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md + 4,
            paddingBottom: Spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.back();
            }}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: Colors.white,
            }}
          >
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                backgroundColor: statusBg,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: callState === 'active' ? 'rgba(4, 120, 87, 0.12)' : 'rgba(17, 24, 39, 0.06)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: statusColor,
                }}
              >
                {statusLabel}
                {callState === 'active' ? ` • ${formatDuration(callDuration)}` : ''}
              </Text>
            </View>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Caller Info */}
        <View
          style={{
            alignItems: 'center',
            marginTop: Spacing.md,
            marginHorizontal: Spacing.lg,
            backgroundColor: Colors.white,
            borderRadius: 28,
            paddingVertical: 26,
            paddingHorizontal: 18,
            borderWidth: 1,
            borderColor: 'rgba(17, 24, 39, 0.045)',
            shadowColor: '#101828',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.045,
            shadowRadius: 18,
            elevation: 0.76,
          }}
        >
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: '#0a0a0a',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.lg,
              borderWidth: 3,
              borderColor: callState === 'active' ? Colors.accent : 'rgba(17, 24, 39, 0.08)',
              overflow: 'hidden',
            }}
          >
            {callerImage ? (
              <Image
                source={{ uri: callerImage }}
                style={{ width: 112, height: 112, borderRadius: 56 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'rgba(202, 255, 51, 0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={36} color={Colors.accent} />
              </View>
            )}
          </View>

          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: Spacing.xs,
              textAlign: 'center',
              letterSpacing: -0.4,
            }}
            numberOfLines={1}
          >
            {callerName}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
            }}
          >
            {isProvider ? 'Client' : 'Provider'}
          </Text>

          {callState === 'outgoing' && (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: callSetupError ? Colors.error : Colors.textSecondaryDark,
                marginTop: Spacing.md,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {callSetupError
                ? callSetupError
                : isCreatingCall
                ? 'Preparing secure call session...'
                : 'Waiting for recipient to answer'}
            </Text>
          )}

          {(callState === 'outgoing' || callState === 'active') && (voice.error || voice.status !== 'idle') && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: voice.error ? Colors.error : Colors.iconMuted,
                marginTop: Spacing.sm,
                paddingHorizontal: Spacing.lg,
                textAlign: 'center',
              }}
            >
              {voice.error
                ? `Audio: ${voice.error}`
                : voice.status === 'starting'
                  ? 'Connecting in-app audio…'
                  : voice.status === 'connected'
                    ? 'In-app audio active'
                    : 'In-app audio unavailable'}
            </Text>
          )}

          {callState === 'ended' && (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginTop: Spacing.md,
              }}
            >
              Duration: {formatDuration(callDuration)}
            </Text>
          )}
        </View>

        {/* Job Details Card */}
        {(callState === 'incoming' || callState === 'outgoing' || callState === 'active' || callState === 'ended') && (
          <JobDetailsCard />
        )}

        {/* Call Controls */}
        {callState === 'incoming' && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: Spacing.xl,
              marginTop: 'auto',
              paddingBottom: Spacing.xl,
            }}
          >
            <TouchableOpacity
              onPress={handleDeclineCall}
              activeOpacity={0.8}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: Colors.errorBright,
                alignItems: 'center',
                justifyContent: 'center',
                ...SHADOWS.md,
              }}
            >
              <PhoneOff size={32} color={Colors.white} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAcceptCall}
              activeOpacity={0.8}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: Colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                ...SHADOWS.md,
              }}
            >
              <Phone size={32} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {callState === 'outgoing' && (
          <View
            style={{
              alignItems: 'center',
              marginTop: 'auto',
              paddingBottom: Spacing.xl,
              gap: Spacing.md,
            }}
          >
            <TouchableOpacity
              onPress={handleEndCall}
              activeOpacity={0.8}
              disabled={isCreatingCall}
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: Colors.errorBright,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isCreatingCall ? 0.6 : 1,
                ...SHADOWS.md,
              }}
            >
              <PhoneOff size={32} color={Colors.white} />
            </TouchableOpacity>

            {!!callSetupError && (
              <TouchableOpacity
                onPress={handleCallAgain}
                activeOpacity={0.8}
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(17, 24, 39, 0.045)',
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                  }}
                >
                  Retry call
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {callState === 'active' && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: Spacing.lg,
              marginTop: 'auto',
              paddingBottom: Spacing.xl,
            }}
          >
            <TouchableOpacity
              onPress={handleToggleMute}
              activeOpacity={0.8}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isMuted ? '#FEF2F2' : Colors.white,
                borderWidth: 1,
                borderColor: isMuted ? 'rgba(220, 38, 38, 0.14)' : 'rgba(17, 24, 39, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                ...SHADOWS.sm,
              }}
            >
              {isMuted ? (
                <MicOff size={24} color={Colors.textPrimary} />
              ) : (
                <Mic size={24} color={Colors.textPrimary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEndCall}
              activeOpacity={0.8}
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: Colors.errorBright,
                alignItems: 'center',
                justifyContent: 'center',
                ...SHADOWS.md,
              }}
            >
              <PhoneOff size={32} color={Colors.white} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleToggleSpeaker}
              activeOpacity={0.8}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isSpeakerOn ? Colors.sageTint : Colors.white,
                borderWidth: 1,
                borderColor: isSpeakerOn ? 'rgba(79, 103, 57, 0.16)' : 'rgba(17, 24, 39, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                ...SHADOWS.sm,
              }}
            >
              <Volume2 size={24} color={isSpeakerOn ? Colors.accent : Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {callState === 'ended' && (
          <View
            style={{
              alignItems: 'center',
              marginTop: 'auto',
              paddingBottom: Spacing.xl,
              gap: Spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
              <TouchableOpacity
                onPress={handleMessage}
                activeOpacity={0.8}
                style={{
                  alignItems: 'center',
                  gap: Spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: Colors.backgroundGray,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...SHADOWS.sm,
                  }}
                >
                  <MessageCircle size={22} color={Colors.textPrimary} />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Message {isProvider ? 'client' : 'provider'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCallAgain}
                activeOpacity={0.8}
                style={{
                  alignItems: 'center',
                  gap: Spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: Colors.backgroundGray,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...SHADOWS.sm,
                  }}
                >
                  <Phone size={24} color={Colors.textPrimary} />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Call again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Call Recording Disclaimer */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: Spacing.lg,
            gap: Spacing.xs,
          }}
        >
          <Shield size={14} color={Colors.textSecondaryDark} />
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
            }}
          >
            Calls are recorded for quality and dispute resolution
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
