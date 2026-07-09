import { useCallback, useRef, useState } from 'react';

import { communicationService } from '@/services/api';
import { logCallDebug, logCallError, logCallWarn } from '@/utils/callDebugLog';
import { loadWebRtcModule, WEBRTC_UNAVAILABLE_MESSAGE } from '@/utils/webrtcAvailability';

type VoiceStatus = 'idle' | 'starting' | 'connected' | 'failed';

export interface VoiceCallWebRtcControls {
  status: VoiceStatus;
  error: string | null;
  lastSessionKeys: string[] | null;
  start: (callReference: string) => Promise<void>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
}

function unwrapPayload(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const inner = r.data ?? r;
    return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : r;
  }
  return {};
}

function extractIceServers(payload: Record<string, unknown>): RTCConfiguration['iceServers'] {
  const direct =
    (payload.iceServers as RTCConfiguration['iceServers']) ??
    (payload.ice_servers as RTCConfiguration['iceServers']) ??
    (payload.rtcConfig as { iceServers?: RTCConfiguration['iceServers'] } | undefined)?.iceServers;

  if (Array.isArray(direct) && direct.length > 0) return direct;

  const urls = payload.urls ?? payload.stunUrl;
  if (typeof urls === 'string') return [{ urls }];
  if (Array.isArray(urls)) return urls as RTCConfiguration['iceServers'];

  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

function findRemoteDescription(payload: Record<string, unknown>): { type: RTCSdpType; sdp: string } | null {
  const flatCandidates: { key: string; type: RTCSdpType }[] = [
    { key: 'offerSdp', type: 'offer' },
    { key: 'answerSdp', type: 'answer' },
    { key: 'remoteSdp', type: 'offer' },
    { key: 'localSdp', type: 'answer' },
    { key: 'sdp', type: 'offer' },
  ];
  for (const { key, type } of flatCandidates) {
    const v = payload[key];
    if (typeof v === 'string' && v.length > 0) {
      return { type, sdp: v };
    }
  }

  const candidates: unknown[] = [
    payload.remoteDescription,
    payload.remote_description,
    payload.offer,
    payload.sdpOffer,
    payload.sdp_offer,
    payload.answer,
    payload.sdpAnswer,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const type = (o.type as RTCSdpType | undefined) ?? 'offer';
    const sdp = o.sdp as string | undefined;
    if (typeof sdp === 'string' && sdp.length > 0) {
      return { type, sdp };
    }
  }

  return null;
}

/** Safe log string for session/ICE JSON (truncate SDP-like fields). */
function previewForLog(obj: unknown, maxLen = 1800): string {
  try {
    const s = JSON.stringify(obj, (k, v) => {
      if (typeof v === 'string' && (k.toLowerCase().includes('sdp') || v.startsWith('v=0'))) {
        return `${v.slice(0, 120)}… (${v.length} chars)`;
      }
      return v;
    });
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(obj);
  }
}

/**
 * react-native-webrtc rejects candidates where both sdpMid and sdpMLineIndex are missing.
 * Many backends only send the candidate string — default sdpMLineIndex to 0.
 */
function parseIceCandidatePayload(raw: unknown): RTCIceCandidateInit | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const candidate = (o.candidate ?? o.candidateString) as string | undefined;
  if (!candidate || typeof candidate !== 'string' || !candidate.trim()) return null;
  let sdpMid = o.sdpMid != null ? String(o.sdpMid) : undefined;
  let sdpMLineIndex: number | undefined =
    typeof o.sdpMLineIndex === 'number' && !Number.isNaN(o.sdpMLineIndex)
      ? o.sdpMLineIndex
      : undefined;
  if (sdpMid == null && sdpMLineIndex == null) {
    sdpMLineIndex = 0;
  }
  return {
    candidate: candidate.trim(),
    sdpMid,
    sdpMLineIndex,
  };
}

/**
 * In-app WebRTC voice using backend session + ICE candidate polling.
 * Requires a dev / production native build (`expo run:ios` / `expo run:android`) — not Expo Go.
 */
export function useVoiceCallWebRtc(): VoiceCallWebRtcControls {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSessionKeys, setLastSessionKeys] = useState<string[] | null>(null);

  const pcRef = useRef<any | null>(null);
  const localStreamRef = useRef<any | null>(null);
  const icePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenCandidateKeysRef = useRef<Set<string>>(new Set());
  const activeRefRef = useRef<string | null>(null);
  /** Log full ICE response only on first poll per call */
  const logIcePayloadOnceRef = useRef(true);

  const stop = useCallback(() => {
    if (icePollRef.current) {
      clearInterval(icePollRef.current);
      icePollRef.current = null;
    }
    seenCandidateKeysRef.current.clear();
    activeRefRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    } catch {
      /* ignore */
    }
    localStreamRef.current = null;

    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    setStatus('idle');
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t: any) => {
      t.enabled = !muted;
    });
  }, []);

  const start = useCallback(
    async (callReference: string) => {
      if (!callReference) {
        setError('Missing call reference');
        setStatus('failed');
        return;
      }

    stop();
    logIcePayloadOnceRef.current = true;
    activeRefRef.current = callReference;
    setError(null);
    setStatus('starting');

      let RTCPeerConnection: any;
      let RTCSessionDescription: any;
      let mediaDevices: any;

      const webrtc = await loadWebRtcModule();
      if (!webrtc) {
        logCallError('useVoiceCallWebRtc: native module unavailable', {
          hint: 'Use expo run:ios / expo run:android — not Expo Go',
        });
        setError(WEBRTC_UNAVAILABLE_MESSAGE);
        setStatus('failed');
        return;
      }

      RTCPeerConnection = webrtc.RTCPeerConnection;
      RTCSessionDescription = webrtc.RTCSessionDescription;
      mediaDevices = webrtc.mediaDevices;

      try {
        const sessionRaw = await communicationService.getCallSession(callReference);
        if (activeRefRef.current !== callReference) return;

        const session = unwrapPayload(sessionRaw);
        setLastSessionKeys(Object.keys(session));

        logCallDebug('WebRTC: GET …/session', {
          callReference,
          keys: Object.keys(session),
          hasOffer: session.hasOffer,
          hasAnswer: session.hasAnswer,
          iceCandidatesCount: session.iceCandidatesCount,
          preview: previewForLog(session),
        });

        const remoteBeforePc = findRemoteDescription(session);
        logCallDebug('WebRTC: parsed remote SDP', {
          found: !!remoteBeforePc,
          type: remoteBeforePc?.type ?? null,
          sdpChars: remoteBeforePc?.sdp?.length ?? 0,
        });

        const iceServers = extractIceServers(session);
        logCallDebug('WebRTC: iceServers in use', {
          count: Array.isArray(iceServers) ? iceServers.length : 0,
          urlsSample: Array.isArray(iceServers)
            ? JSON.stringify(iceServers).slice(0, 200)
            : String(iceServers),
        });
        const pc = new RTCPeerConnection({ iceServers }) as any;
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
          try {
            const cs = pc.connectionState;
            const ics = pc.iceConnectionState;
            if (__DEV__) logCallDebug('WebRTC: connectionState', { connectionState: cs, iceConnectionState: ics });
            if (cs === 'connected' || ics === 'completed') {
              setStatus('connected');
            }
            if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
              setStatus('failed');
            }
          } catch (handlerErr) {
            if (__DEV__) logCallWarn('WebRTC: onconnectionstatechange handler', { message: String(handlerErr) });
          }
        };

        pc.onicecandidate = (ev: { candidate?: { candidate?: string } | null }) => {
          if (ev.candidate && __DEV__) {
            logCallDebug('WebRTC: local ICE candidate', { candidate: ev.candidate.candidate?.slice(0, 80) });
          }
          // If your backend expects posted ICE from client, add POST here.
        };

        pc.ontrack = (ev: any) => {
          if (__DEV__) {
            logCallDebug('WebRTC: remote track', { kind: ev.track?.kind });
          }
          // Remote audio plays through the active voice session on device when stream is live.
        };

        const local = await mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (activeRefRef.current !== callReference) {
          local.getTracks().forEach((t: any) => t.stop());
          return;
        }
        localStreamRef.current = local;
        local.getTracks().forEach((track: any) => pc.addTrack(track, local));

        const remote = findRemoteDescription(session);
        if (remote) {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: remote.type, sdp: remote.sdp })
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (__DEV__) {
            logCallDebug('WebRTC: applied remote SDP, created local answer', { type: remote.type });
          }
        } else {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          if (__DEV__) {
            logCallWarn(
              'WebRTC: no remote SDP in session response — created local offer. Backend may need to accept this via POST for full P2P.',
              { keys: Object.keys(session) }
            );
          }
        }

        const pollIce = async () => {
          if (activeRefRef.current !== callReference || !pcRef.current) return;
          try {
            const iceRaw = await communicationService.getIceCandidates(callReference);
            const icePayload = unwrapPayload(iceRaw);
            if (logIcePayloadOnceRef.current) {
              logCallDebug('WebRTC: GET …/ice-candidates (first poll)', {
                callReference,
                payloadKeys: iceRaw && typeof iceRaw === 'object' ? Object.keys(iceRaw as object) : [],
                innerKeys: Object.keys(icePayload),
                preview: previewForLog(iceRaw, 1200),
              });
              logIcePayloadOnceRef.current = false;
            }
            const list =
              (Array.isArray(icePayload.candidates) && icePayload.candidates) ||
              (Array.isArray(icePayload.iceCandidates) && icePayload.iceCandidates) ||
              (Array.isArray(iceRaw as any) ? (iceRaw as any) : []);

            const arr = Array.isArray(list) ? list : [];
            let added = 0;
            for (const item of arr) {
              const init = parseIceCandidatePayload(item);
              if (!init?.candidate) continue;
              const key = `${init.sdpMid ?? ''}-${init.sdpMLineIndex ?? ''}-${init.candidate}`;
              if (seenCandidateKeysRef.current.has(key)) continue;
              seenCandidateKeysRef.current.add(key);
              try {
                // Pass init object — native addIceCandidate clones it; avoids RTCIceCandidate ctor edge cases
                await pc.addIceCandidate(init);
                added += 1;
              } catch (iceErr) {
                logCallWarn('WebRTC: addIceCandidate failed', { message: String(iceErr) });
              }
            }
            if (added > 0) {
              logCallDebug('WebRTC: ICE candidates applied', { addedThisPoll: added, totalSeen: seenCandidateKeysRef.current.size });
            }
          } catch (pollErr) {
            logCallWarn('WebRTC: ICE poll failed', { message: String(pollErr) });
          }
        };

        await pollIce();
        icePollRef.current = setInterval(pollIce, 1500);
        setStatus('connected');
      } catch (err) {
        logCallError('useVoiceCallWebRtc: start failed', { message: String(err) });
        setError(err instanceof Error ? err.message : 'Voice connection failed');
        setStatus('failed');
        stop();
      }
    },
    [stop]
  );

  return { status, error, lastSessionKeys, start, stop, setMuted };
}
