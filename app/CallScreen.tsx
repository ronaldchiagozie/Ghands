import { CallView } from "@/components/call/CallView";
import { useCallSession } from "@/hooks/useCallSession";
import { haptics } from "@/hooks/useHaptics";
import { buildChatScreenParams, navigateBack } from "@/utils/navigation";
import {
  markCallLive,
  openChatFromCall,
  takeRedialRequest,
} from "@/utils/callChatNavigation";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import React, { useCallback, useEffect, useRef } from "react";

export type CallState = "incoming" | "outgoing" | "active" | "ended";

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

const CLOSE_FALLBACK = "/(tabs)/jobs";

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CallScreenParams>();
  const isProvider = params.isProvider === "true";
  const requestId = params.requestId
    ? Number.parseInt(params.requestId, 10)
    : NaN;

  const call = useCallSession({
    initialPhase: params.callState === "outgoing" ? "outgoing" : "incoming",
    requestId: Number.isFinite(requestId) ? requestId : null,
    callId: params.callId ?? null,
    callReference: params.callReference ?? null,
  });

  const navigation = useNavigation();
  const isLive = call.phase !== "ended";
  const isFocusedRef = useRef(true);
  const endedWhileAwayRef = useRef(false);
  const close = useCallback(
    () => navigateBack(router, CLOSE_FALLBACK),
    [router],
  );

  useEffect(() => {
    markCallLive(params.requestId, isLive);
    if (!isLive && !isFocusedRef.current) endedWhileAwayRef.current = true;
  }, [isLive, params.requestId]);

  useEffect(
    () => () => markCallLive(params.requestId, false),
    [params.requestId],
  );

  /**
   * Coming back to this screen from the chat. Asked to ring again: ring. The
   * call ended while the chat was open: there is nothing to come back to, so
   * keep going back rather than show a finished call as if it were live.
   */
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (takeRedialRequest(params.requestId)) {
        endedWhileAwayRef.current = false;
        call.callAgain();
      } else if (endedWhileAwayRef.current) {
        endedWhileAwayRef.current = false;
        close();
      }
      return () => {
        isFocusedRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.requestId]),
  );

  const name =
    params.callerName?.trim() || (isProvider ? "Customer" : "Your provider");
  const jobTitle = params.jobTitle?.trim();

  const onMessage = useCallback(() => {
    haptics.light();
    if (!params.requestId) return;
    openChatFromCall(
      router,
      navigation,
      params.requestId,
      buildChatScreenParams({
        providerName: isProvider ? undefined : name,
        clientName: isProvider ? name : undefined,
        providerId: params.callerId,
        /** The face the call is showing, so the chat it hops to shows the same one. */
        peerImage: params.callerImage,
        requestId: params.requestId,
        fromJobHub: true,
      }),
      isLive,
    );
  }, [
    isProvider,
    name,
    params.callerId,
    params.callerImage,
    params.requestId,
    isLive,
    navigation,
    router,
  ]);

  return (
    <CallView
      name={name}
      roleLabel={isProvider ? "Customer" : "Provider"}
      avatarUri={params.callerImage?.trim() || null}
      jobTitle={jobTitle && jobTitle !== "Service Request" ? jobTitle : null}
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
      onClose={close}
    />
  );
}
