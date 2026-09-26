import { CallView } from '@/components/call/CallView';
import { useCallSession } from '@/hooks/useCallSession';
import { haptics } from '@/hooks/useHaptics';
import { buildChatScreenParams, navigateBack } from '@/utils/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

export type CallState = 'incoming' | 'outgoing' | 'active' | 'ended';

type CallScreenParams = {
  callState?: CallState;
  callerName?: string;
  callerId?: string;
  callerImage?: string;
  jobTitle?: string;
  requestId?: string;
  isProvider?: string;
  /** From the incoming-call notification, when it carries them. */
  callId?: string;
  callReference?: string;
};

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CallScreenParams>();
  const isProvider = params.isProvider === 'true';
  const requestId = params.requestId ? Number.parseInt(params.requestId, 10) : NaN;

  const call = useCallSession({
    initialPhase: params.callState === 'outgoing' ? 'outgoing' : 'incoming',
    requestId: Number.isFinite(requestId) ? requestId : null,
    callId: params.callId ?? null,
    callReference: params.callReference ?? null,
  });

  const name = params.callerName?.trim() || (isProvider ? 'Customer' : 'Your provider');
  const jobTitle = params.jobTitle?.trim();

  const onMessage = useCallback(() => {
    haptics.light();
    if (!params.requestId) return;
    router.push({
      pathname: '/ChatScreen',
      params: buildChatScreenParams({
        providerName: isProvider ? undefined : name,
        clientName: isProvider ? name : undefined,
        providerId: params.callerId,
        requestId: params.requestId,
        fromJobHub: true,
      }),
    } as any);
  }, [isProvider, name, params.callerId, params.requestId, router]);

  return (
    <CallView
      name={name}
      roleLabel={isProvider ? 'Customer' : 'Provider'}
      avatarUri={params.callerImage?.trim() || null}
      jobTitle={jobTitle && jobTitle !== 'Service Request' ? jobTitle : null}
      phase={call.phase}
      endReason={call.endReason}
      error={call.error}
      isSettingUp={call.isSettingUp}
      isInterrupted={call.isInterrupted}
      duration={call.duration}
      isMuted={call.isMuted}
      isSpeakerOn={call.isSpeakerOn}
      canSwitchSpeaker={call.canSwitchSpeaker}
      onAnswer={() => {
        haptics.success();
        void call.answer();
      }}
      onDecline={() => {
        haptics.error();
        call.decline();
      }}
      onHangUp={() => {
        haptics.error();
        call.hangUp();
      }}
      onCallAgain={() => {
        haptics.light();
        call.callAgain();
      }}
      onToggleMute={() => {
        haptics.light();
        call.toggleMute();
      }}
      onToggleSpeaker={() => {
        haptics.light();
        call.toggleSpeaker();
      }}
      onMessage={params.requestId ? onMessage : undefined}
      onClose={() => navigateBack(router, '/(tabs)/jobs')}
    />
  );
}
