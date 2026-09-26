import { CallEngine, type CallEngineEvent, type SignalingSocket, type WebRtcApi } from '@/utils/callEngine';

/**
 * Two phones and a server that follows the backend's signalling contract:
 * join-call announces you to the room, offer / answer / ice-candidate are
 * relayed to the other party, end-call and reject-call are broadcast.
 */
class FakeServer {
  private rooms = new Map<string, Set<FakeSocket>>();

  handle(from: FakeSocket, event: string, payload: any) {
    const ref = payload?.callReference;
    const room = this.rooms.get(ref) ?? new Set<FakeSocket>();
    this.rooms.set(ref, room);
    const others = [...room].filter((s) => s !== from);
    if (event === 'join-call') {
      room.add(from);
      from.deliver('joined-call', { callReference: ref });
      others.forEach((s) => s.deliver('user-joined', { callReference: ref }));
    } else if (['offer', 'answer', 'ice-candidate'].includes(event)) {
      others.forEach((s) => s.deliver(event, payload));
    } else if (event === 'end-call') {
      others.forEach((s) => s.deliver('call-ended', { callReference: ref }));
    } else if (event === 'reject-call') {
      others.forEach((s) => s.deliver('call-rejected', { callReference: ref }));
    }
  }
}

class FakeSocket implements SignalingSocket {
  connected = true;
  private handlers = new Map<string, ((p: any) => void)[]>();
  constructor(private server: FakeServer) {}
  emit(event: string, payload: unknown) {
    setTimeout(() => this.server.handle(this, event, payload), 0);
  }
  on(event: string, handler: (p: any) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }
  deliver(event: string, payload: any) {
    setTimeout(() => (this.handlers.get(event) ?? []).forEach((h) => h(payload)), 0);
  }
  disconnect() {
    this.connected = false;
  }
}

class FakePeerConnection {
  localDescription: any = null;
  remoteDescription: any = null;
  connectionState = 'new';
  iceConnectionState = 'new';
  addedCandidates: any[] = [];
  onicecandidate: ((e: any) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  addTrack() {}
  async createOffer() {
    return { type: 'offer', sdp: 'v=0 offer' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'v=0 answer' };
  }
  async setLocalDescription(d: any) {
    this.localDescription = d;
    setTimeout(() => this.onicecandidate?.({ candidate: { candidate: `cand-${d.type}`, sdpMid: '0', sdpMLineIndex: 0 } }), 0);
    this.maybeConnect();
  }
  async setRemoteDescription(d: any) {
    this.remoteDescription = d;
    this.maybeConnect();
  }
  async addIceCandidate(c: any) {
    if (!this.remoteDescription) throw new Error('no remote description');
    this.addedCandidates.push(c);
  }
  close() {
    this.connectionState = 'closed';
  }
  private maybeConnect() {
    if (this.localDescription && this.remoteDescription) {
      setTimeout(() => {
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
      }, 0);
    }
  }
}

const peers: FakePeerConnection[] = [];
const webrtc: WebRtcApi = {
  RTCPeerConnection: class {
    constructor() {
      const pc = new FakePeerConnection();
      peers.push(pc);
      return pc as any;
    }
  } as any,
  RTCSessionDescription: class {
    constructor(init: any) {
      return init;
    }
  } as any,
  mediaDevices: {
    getUserMedia: async () => ({ getTracks: () => [{ stop() {} }], getAudioTracks: () => [] }),
  },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

function phone(server: FakeServer, role: 'caller' | 'callee') {
  const events: CallEngineEvent['type'][] = [];
  const engine = new CallEngine({
    callReference: 'CALL_1',
    role,
    socket: new FakeSocket(server),
    webrtc,
    iceServers: [],
    offerNudgeMs: 20,
    onEvent: (e) => events.push(e.type),
  });
  return { engine, events };
}

beforeEach(() => {
  peers.length = 0;
});

describe('a call between two phones', () => {
  it('connects when the caller rings first and the callee answers', async () => {
    const server = new FakeServer();
    const caller = phone(server, 'caller');
    await caller.engine.startMedia();
    await settle();

    const callee = phone(server, 'callee');
    await settle();
    expect(caller.events).toContain('peer-joined');

    await callee.engine.startMedia();
    await settle();

    expect(caller.events).toContain('answered');
    expect(caller.events).toContain('connected');
    expect(callee.events).toContain('connected');
  });

  it('connects when the callee was in the room before the caller', async () => {
    const server = new FakeServer();
    const callee = phone(server, 'callee');
    await settle();
    const caller = phone(server, 'caller');
    await caller.engine.startMedia();
    await settle();

    await callee.engine.startMedia();
    await settle();

    expect(caller.events).toContain('connected');
    expect(callee.events).toContain('connected');
  });

  it('offers once the caller has a microphone, if the callee joined during the prompt', async () => {
    const server = new FakeServer();
    const caller = phone(server, 'caller');
    const callee = phone(server, 'callee');
    await settle();
    await callee.engine.startMedia();
    await caller.engine.startMedia();
    await settle();
    await settle();

    expect(caller.events).toContain('connected');
    expect(callee.events).toContain('connected');
  });

  it('applies candidates that arrive before the other side has described itself', async () => {
    const server = new FakeServer();
    const caller = phone(server, 'caller');
    await caller.engine.startMedia();
    const callee = phone(server, 'callee');
    await settle();
    await callee.engine.startMedia();
    await settle();

    const calleePc = peers[1];
    expect(calleePc.addedCandidates.map((c) => c.candidate)).toContain('cand-offer');
  });

  it('tells the callee when the caller hangs up before they answer', async () => {
    const server = new FakeServer();
    const caller = phone(server, 'caller');
    await caller.engine.startMedia();
    const callee = phone(server, 'callee');
    await settle();

    caller.engine.hangUp(0);
    await settle();

    expect(callee.events).toContain('remote-ended');
  });

  it('tells the caller when the callee declines', async () => {
    const server = new FakeServer();
    const caller = phone(server, 'caller');
    await caller.engine.startMedia();
    const callee = phone(server, 'callee');
    await settle();

    callee.engine.reject();
    await settle();

    expect(caller.events).toContain('remote-rejected');
  });

  it('gives up if the caller never comes', async () => {
    const server = new FakeServer();
    const callee = phone(server, 'callee');
    await callee.engine.startMedia();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(callee.events).toContain('failed');
  });
});
