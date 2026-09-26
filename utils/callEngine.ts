/**
 * One voice call between a customer and a provider: signalling over the
 * backend's socket.io server, audio over WebRTC.
 *
 * The contract (backend, "Call signaling contract"):
 * - connect with `auth: { token }`, then `join-call { callReference }`; the
 *   other party in the room gets `user-joined`.
 * - `offer` / `answer` / `ice-candidate` are relayed to the other party under
 *   the same event name, each as `{ callReference, <payload> }`.
 * - `end-call { callReference, duration }` -> `call-ended` to the room;
 *   `reject-call { callReference }` -> `call-rejected`.
 *
 * Only the caller makes an offer, so the two sides can never both offer at
 * once. It makes it when the callee joins the room; a callee that joined
 * first (and so was never announced) asks again by re-joining until an offer
 * arrives. Every resend repeats the description already made rather than
 * starting a new negotiation, so a repeat is harmless.
 *
 * This file is identical in the customer and provider apps.
 */

export type CallRole = 'caller' | 'callee';

export type CallEngineEvent =
  | { type: 'peer-joined' }
  /** Caller only: the callee's answer arrived, so they picked up. */
  | { type: 'answered' }
  | { type: 'connected' }
  /** The audio path dropped; it may come back on its own. */
  | { type: 'interrupted' }
  | { type: 'remote-ended' }
  | { type: 'remote-rejected' }
  | { type: 'failed'; message: string };

export interface SignalingSocket {
  connected?: boolean;
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: any) => void): void;
  disconnect(): void;
}

/** The slice of react-native-webrtc this uses; faked in tests. */
export interface WebRtcApi {
  RTCPeerConnection: new (config: { iceServers: unknown[] }) => any;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => any;
  mediaDevices: { getUserMedia(constraints: { audio: boolean; video: boolean }): Promise<any> };
}

export interface CallEngineOptions {
  callReference: string;
  role: CallRole;
  socket: SignalingSocket;
  webrtc: WebRtcApi;
  iceServers: unknown[];
  onEvent: (event: CallEngineEvent) => void;
  /** How long a callee waits for an offer before re-joining to ask again. */
  offerNudgeMs?: number;
}

const DEFAULT_OFFER_NUDGE_MS = 3000;
const MAX_OFFER_NUDGES = 4;

function sameCall(payload: any, callReference: string): boolean {
  const ref = payload?.callReference;
  return ref == null || String(ref) === callReference;
}

function toIceInit(raw: any): { candidate: string; sdpMid?: string; sdpMLineIndex?: number } | null {
  const c = raw?.candidate && typeof raw.candidate === 'object' ? raw.candidate : raw;
  const candidate = typeof c?.candidate === 'string' ? c.candidate.trim() : '';
  if (!candidate) return null;
  const sdpMid = c.sdpMid != null ? String(c.sdpMid) : undefined;
  let sdpMLineIndex = typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : undefined;
  /** react-native-webrtc rejects a candidate with neither. */
  if (sdpMid == null && sdpMLineIndex == null) sdpMLineIndex = 0;
  return { candidate, sdpMid, sdpMLineIndex };
}

function toDescription(raw: any, fallbackType: 'offer' | 'answer'): { type: string; sdp: string } | null {
  const d = raw?.sdp && typeof raw.sdp === 'object' ? raw.sdp : raw;
  if (typeof d === 'string' && d) return { type: fallbackType, sdp: d };
  if (typeof d?.sdp !== 'string' || !d.sdp) return null;
  return { type: typeof d.type === 'string' ? d.type : fallbackType, sdp: d.sdp };
}

export class CallEngine {
  private readonly opts: CallEngineOptions;
  private pc: any = null;
  private localStream: any = null;
  private pendingOffer: { type: string; sdp: string } | null = null;
  private pendingIce: { candidate: string; sdpMid?: string; sdpMLineIndex?: number }[] = [];
  private offerSent = false;
  private peerPresent = false;
  private remoteApplied = false;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private nudges = 0;
  private disposed = false;
  private connected = false;

  /**
   * Joins the call's room as soon as the socket is connected, and again after
   * every reconnect. A callee is in the room before answering, so it hears the
   * caller cancel.
   */
  constructor(opts: CallEngineOptions) {
    this.opts = opts;
    this.bindSocket();
    if (opts.socket.connected) this.join();
  }

  private join(): void {
    this.opts.socket.emit('join-call', { callReference: this.opts.callReference });
  }

  /**
   * Open the microphone and the peer connection. The caller does this at once
   * so it is ready to offer the moment the callee joins; the callee does it on
   * Answer, which is also when the microphone prompt should appear.
   */
  async startMedia(): Promise<void> {
    if (this.pc || this.disposed) return;
    const { webrtc, iceServers } = this.opts;

    const stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
    if (this.disposed) {
      stream.getTracks?.().forEach((t: any) => t.stop());
      return;
    }
    this.localStream = stream;

    const pc = new webrtc.RTCPeerConnection({ iceServers });
    this.pc = pc;
    stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

    pc.onicecandidate = (event: any) => {
      const c = event?.candidate;
      if (!c?.candidate) return;
      this.opts.socket.emit('ice-candidate', {
        callReference: this.opts.callReference,
        candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex },
      });
    };

    /** Some react-native-webrtc builds only ever update one of these two. */
    const onState = () => this.reportState();
    pc.onconnectionstatechange = onState;
    pc.oniceconnectionstatechange = onState;

    /** The callee may have joined while the caller was still on the microphone prompt. */
    if (this.opts.role === 'caller' && this.peerPresent) {
      await this.sendOffer();
    }

    if (this.opts.role === 'callee') {
      if (this.pendingOffer) {
        const offer = this.pendingOffer;
        this.pendingOffer = null;
        await this.applyOffer(offer);
      } else {
        /** Re-joining announces us again, which is what makes the caller offer. */
        this.join();
        this.scheduleNudge();
      }
    }
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks?.().forEach((t: any) => {
      t.enabled = !muted;
    });
  }

  hangUp(durationSeconds: number): void {
    if (this.disposed) return;
    this.opts.socket.emit('end-call', { callReference: this.opts.callReference, duration: durationSeconds });
    this.dispose();
  }

  reject(): void {
    if (this.disposed) return;
    this.opts.socket.emit('reject-call', { callReference: this.opts.callReference });
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = null;
    try {
      this.localStream?.getTracks?.().forEach((t: any) => t.stop());
    } catch {
      /* already stopped */
    }
    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.pc = null;
    this.localStream = null;
    try {
      this.opts.socket.disconnect();
    } catch {
      /* already gone */
    }
  }

  private emit(event: CallEngineEvent): void {
    if (!this.disposed) this.opts.onEvent(event);
  }

  private fail(error: unknown, fallback: string): void {
    const message = error instanceof Error && error.message ? error.message : fallback;
    this.emit({ type: 'failed', message });
  }

  private bindSocket(): void {
    const { socket, callReference } = this.opts;

    /** After a dropped connection the server has forgotten this socket's room. */
    socket.on('connect', () => {
      if (!this.disposed) this.join();
    });

    socket.on('user-joined', (payload) => {
      if (this.disposed || !sameCall(payload, callReference)) return;
      this.peerPresent = true;
      this.emit({ type: 'peer-joined' });
      if (this.opts.role === 'caller') void this.sendOffer();
    });

    socket.on('offer', (payload) => {
      if (this.disposed || this.opts.role !== 'callee' || !sameCall(payload, callReference)) return;
      const offer = toDescription(payload?.offer ?? payload, 'offer');
      if (!offer) return;
      if (!this.pc) {
        this.pendingOffer = offer;
        return;
      }
      void this.applyOffer(offer);
    });

    socket.on('answer', (payload) => {
      if (this.disposed || this.opts.role !== 'caller' || !sameCall(payload, callReference)) return;
      const answer = toDescription(payload?.answer ?? payload, 'answer');
      if (!answer || !this.pc || this.remoteApplied) return;
      void this.applyAnswer(answer);
    });

    socket.on('ice-candidate', (payload) => {
      if (this.disposed || !sameCall(payload, callReference)) return;
      const init = toIceInit(payload);
      if (!init) return;
      if (this.pc && this.remoteApplied) {
        this.pc.addIceCandidate(init).catch(() => undefined);
      } else {
        this.pendingIce.push(init);
      }
    });

    socket.on('call-ended', (payload) => {
      if (!this.disposed && sameCall(payload, callReference)) this.emit({ type: 'remote-ended' });
    });

    socket.on('call-rejected', (payload) => {
      if (!this.disposed && sameCall(payload, callReference)) this.emit({ type: 'remote-rejected' });
    });
  }

  private async sendOffer(): Promise<void> {
    const pc = this.pc;
    if (!pc || this.remoteApplied) return;
    try {
      if (!this.offerSent) {
        this.offerSent = true;
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
      }
      const local = pc.localDescription;
      if (!local?.sdp) return;
      this.opts.socket.emit('offer', {
        callReference: this.opts.callReference,
        offer: { type: local.type ?? 'offer', sdp: local.sdp },
      });
    } catch (error) {
      this.fail(error, 'Could not start the call audio.');
    }
  }

  private async applyOffer(offer: { type: string; sdp: string }): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = null;
    try {
      if (!this.remoteApplied) {
        await pc.setRemoteDescription(new this.opts.webrtc.RTCSessionDescription(offer));
        this.remoteApplied = true;
        this.flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
      }
      /** A repeated offer gets the same answer again, not a new negotiation. */
      const local = pc.localDescription;
      if (!local?.sdp) return;
      this.opts.socket.emit('answer', {
        callReference: this.opts.callReference,
        answer: { type: local.type ?? 'answer', sdp: local.sdp },
      });
    } catch (error) {
      this.fail(error, 'Could not connect the call audio.');
    }
  }

  private async applyAnswer(answer: { type: string; sdp: string }): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new this.opts.webrtc.RTCSessionDescription(answer));
      this.remoteApplied = true;
      this.flushIce();
      this.emit({ type: 'answered' });
    } catch (error) {
      this.fail(error, 'Could not connect the call audio.');
    }
  }

  private flushIce(): void {
    const pc = this.pc;
    if (!pc) return;
    const queued = this.pendingIce;
    this.pendingIce = [];
    queued.forEach((init) => {
      pc.addIceCandidate(init).catch(() => undefined);
    });
  }

  private scheduleNudge(): void {
    if (this.nudgeTimer || this.disposed) return;
    this.nudgeTimer = setTimeout(() => {
      this.nudgeTimer = null;
      if (this.disposed || this.remoteApplied) return;
      if (this.nudges >= MAX_OFFER_NUDGES) {
        this.emit({ type: 'failed', message: 'The other phone did not connect. Please try again.' });
        return;
      }
      this.nudges += 1;
      this.join();
      this.scheduleNudge();
    }, this.opts.offerNudgeMs ?? DEFAULT_OFFER_NUDGE_MS);
  }

  private reportState(): void {
    const pc = this.pc;
    if (!pc) return;
    const cs = pc.connectionState;
    const ics = pc.iceConnectionState;
    if (cs === 'connected' || ics === 'connected' || ics === 'completed') {
      if (!this.connected) {
        this.connected = true;
        this.emit({ type: 'connected' });
      }
      return;
    }
    if (cs === 'failed' || ics === 'failed') {
      this.emit({ type: 'failed', message: 'The call audio could not connect.' });
      return;
    }
    if (this.connected && (cs === 'disconnected' || ics === 'disconnected')) {
      this.connected = false;
      this.emit({ type: 'interrupted' });
    }
  }
}
