import { useCallback, useEffect, useRef, useState } from 'react';

import { communicationService } from '@/services/api';
import { callAudio } from '@/utils/callAudio';
import { CallEngine, type CallEngineEvent, type CallRole } from '@/utils/callEngine';
import { logCallWarn } from '@/utils/callDebugLog';
import { extractIceServers, pickRingingCall, type CallIds } from '@/utils/callSession';
import { openCallSocket } from '@/utils/callSignaling';
import { loadWebRtcModule } from '@/utils/webrtcAvailability';

export type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'active' | 'ended';

export type CallEndReason =
  | 'hung_up'
  | 'remote_hung_up'
  | 'declined'
  | 'remote_declined'
  | 'no_answer'
  | 'missed'
  | 'failed';

/** Long enough for someone to find their phone; what most call apps allow. */
const RING_TIMEOUT_MS = 45_000;
/** Answered, but audio never started - usually a network that blocks it. */
const CONNECT_TIMEOUT_MS = 30_000;
/** How long a dropped call gets to come back before it is over. */
const INTERRUPTED_TIMEOUT_MS = 15_000;
const SOCKET_CONNECT_TIMEOUT_MS = 15_000;

const MIC_DENIED = /permission|denied|not allowed|notallowed/i;

function readableFailure(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (MIC_DENIED.test(message)) return 'Allow microphone access in Settings to make calls.';
  return message || fallback;
}

type Options = {
  initialPhase: 'incoming' | 'outgoing';
  requestId: number | null;
  callId?: string | null;
  callReference?: string | null;
};

/**
 * One call from ring to hang-up. The screen only draws what this returns.
 * Identical in both apps.
 */
export function useCallSession({ initialPhase, requestId, callId, callReference }: Options) {
  const [phase, setPhase] = useState<CallPhase>(initialPhase);
  const [endReason, setEndReason] = useState<CallEndReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(initialPhase === 'outgoing');
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const engineRef = useRef<CallEngine | null>(null);
  const idsRef = useRef<CallIds | null>(
    callId && callReference ? { callId, callReference } : null,
  );
  const phaseRef = useRef<CallPhase>(initialPhase);
  const durationRef = useRef(0);
  const attemptRef = useRef(0);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  phaseRef.current = phase;
  durationRef.current = duration;

  const clearTimer = (name: string) => {
    const t = timersRef.current[name];
    if (t) clearTimeout(t);
    timersRef.current[name] = undefined;
  };
  const clearAllTimers = () => Object.keys(timersRef.current).forEach(clearTimer);
  const setTimer = (name: string, ms: number, fn: () => void) => {
    clearTimer(name);
    timersRef.current[name] = setTimeout(fn, ms);
  };

  const patchStatus = useCallback((status: string) => {
    const id = idsRef.current?.callId;
    if (!id) return;
    communicationService.updateCallStatus(id, status).catch((err) => {
      logCallWarn('useCallSession: status update failed', { status, message: String(err) });
    });
  }, []);

  const finish = useCallback((reason: CallEndReason, message?: string) => {
    if (phaseRef.current === 'ended') return;
    clearAllTimers();
    engineRef.current?.dispose();
    engineRef.current = null;
    callAudio.stop();
    phaseRef.current = 'ended';
    setPhase('ended');
    setEndReason(reason);
    setError(message ?? null);
    setIsSettingUp(false);
    setIsInterrupted(false);
  }, []);

  const onEngineEvent = useCallback(
    (event: CallEngineEvent) => {
      switch (event.type) {
        case 'answered':
          clearTimer('ring');
          callAudio.stopRinging();
          setPhase('connecting');
          setTimer('connect', CONNECT_TIMEOUT_MS, () =>
            finish('failed', 'The call could not connect. Check your connection and try again.'),
          );
          break;
        case 'connected':
          clearTimer('connect');
          clearTimer('interrupted');
          setIsInterrupted(false);
          setPhase('active');
          break;
        case 'interrupted':
          setIsInterrupted(true);
          setTimer('interrupted', INTERRUPTED_TIMEOUT_MS, () => finish('failed', 'The call dropped.'));
          break;
        case 'remote-ended':
          finish(phaseRef.current === 'incoming' ? 'missed' : 'remote_hung_up');
          break;
        case 'remote-rejected':
          finish('remote_declined');
          break;
        case 'failed':
          finish('failed', event.message);
          break;
        default:
          break;
      }
    },
    [finish],
  );

  /** Socket, ICE servers and engine for one call. Throws with a readable message. */
  const createEngine = useCallback(
    async (ids: CallIds, role: CallRole): Promise<CallEngine> => {
      const webrtc = await loadWebRtcModule();
      if (!webrtc) throw new Error('Calls work in the installed app only, not Expo Go.');

      const [socket, session] = await Promise.all([
        openCallSocket(),
        communicationService.getCallSession(ids.callReference).catch(() => null),
      ]);

      setTimer('socket', SOCKET_CONNECT_TIMEOUT_MS, () => {
        if (!(socket as any).connected) finish('failed', 'Could not reach the call service. Please try again.');
      });
      socket.on('connect', () => clearTimer('socket'));

      return new CallEngine({
        callReference: ids.callReference,
        role,
        socket,
        webrtc: webrtc as any,
        iceServers: extractIceServers(session),
        onEvent: onEngineEvent,
      });
    },
    [finish, onEngineEvent],
  );

  const placeCall = useCallback(async () => {
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current || phaseRef.current === 'ended';
    if (requestId == null) {
      finish('failed', 'This call is missing its job.');
      return;
    }
    setIsSettingUp(true);
    try {
      const ids = await communicationService.initiateCall(requestId);
      if (stale()) return;
      if (!ids.callId || !ids.callReference) throw new Error('Could not start the call. Please try again.');
      idsRef.current = ids;
      patchStatus('ringing');

      const engine = await createEngine(ids, 'caller');
      if (stale()) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      callAudio.startRinging();
      await engine.startMedia();
      if (stale()) return;
      setIsSettingUp(false);
      setTimer('ring', RING_TIMEOUT_MS, () => {
        engineRef.current?.hangUp(0);
        patchStatus('ended');
        finish('no_answer');
      });
    } catch (err) {
      if (!stale()) finish('failed', readableFailure(err, 'Could not start the call. Please try again.'));
    }
  }, [createEngine, finish, patchStatus, requestId]);

  const listenForIncoming = useCallback(async () => {
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current || phaseRef.current === 'ended';
    try {
      let ids = idsRef.current;
      if (!ids && requestId != null) {
        const history = await communicationService.getCallHistory(requestId, { limit: 5 });
        ids = pickRingingCall(history.calls);
      }
      if (stale()) return;
      if (!ids) {
        finish('missed');
        return;
      }
      idsRef.current = ids;
      const engine = await createEngine(ids, 'callee');
      if (stale()) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      setTimer('ring', RING_TIMEOUT_MS + 15_000, () => finish('missed'));
    } catch (err) {
      if (!stale()) finish('failed', readableFailure(err, 'This call could not be answered.'));
    }
  }, [createEngine, finish, requestId]);

  useEffect(() => {
    if (initialPhase === 'outgoing') void placeCall();
    else void listenForIncoming();

    return () => {
      attemptRef.current += 1;
      const current = phaseRef.current;
      const engine = engineRef.current;
      if (engine && current !== 'ended') {
        /** Leaving the screen ends the call; an unanswered one counts as declined. */
        if (current === 'incoming') {
          engine.reject();
          patchStatus('rejected');
        } else {
          engine.hangUp(durationRef.current);
          patchStatus('ended');
        }
      }
      engineRef.current = null;
      clearAllTimers();
      callAudio.stop();
    };
    // Mount-only: a new call is a new screen or callAgain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const answer = useCallback(async () => {
    const engine = engineRef.current;
    if (phaseRef.current !== 'incoming' || !engine) return;
    clearTimer('ring');
    setPhase('connecting');
    patchStatus('connected');
    callAudio.start();
    setTimer('connect', CONNECT_TIMEOUT_MS, () =>
      finish('failed', 'The call could not connect. Check your connection and try again.'),
    );
    try {
      await engine.startMedia();
    } catch (err) {
      finish('failed', readableFailure(err, 'Could not start the call audio.'));
    }
  }, [finish, patchStatus]);

  const decline = useCallback(() => {
    engineRef.current?.reject();
    patchStatus('rejected');
    finish('declined');
  }, [finish, patchStatus]);

  const hangUp = useCallback(() => {
    engineRef.current?.hangUp(durationRef.current);
    patchStatus('ended');
    finish('hung_up');
  }, [finish, patchStatus]);

  const callAgain = useCallback(() => {
    idsRef.current = null;
    phaseRef.current = 'outgoing';
    setPhase('outgoing');
    setEndReason(null);
    setError(null);
    setDuration(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    void placeCall();
  }, [placeCall]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      engineRef.current?.setMuted(!prev);
      return !prev;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      callAudio.setSpeaker(!prev);
      return !prev;
    });
  }, []);

  return {
    phase,
    endReason,
    error,
    isSettingUp,
    isInterrupted,
    duration,
    isMuted,
    isSpeakerOn,
    canSwitchSpeaker: callAudio.canSwitchSpeaker,
    answer,
    decline,
    hangUp,
    callAgain,
    toggleMute,
    toggleSpeaker,
  };
}
