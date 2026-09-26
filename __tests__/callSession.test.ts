import { callStatusText } from '@/components/call/CallView';
import { extractIceServers, pickRingingCall } from '@/utils/callSession';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

describe('finding the call a notification is about', () => {
  it('takes the newest call on the job that is still ringing', () => {
    expect(
      pickRingingCall([
        { id: 1, callReference: 'CALL_OLD', status: 'ringing', createdAt: '2026-09-26T10:00:00Z' },
        { id: 2, callReference: 'CALL_NEW', status: 'ringing', createdAt: '2026-09-26T10:05:00Z' },
      ]),
    ).toEqual({ callId: '2', callReference: 'CALL_NEW' });
  });

  it('finds nothing once the caller has given up', () => {
    expect(pickRingingCall([{ id: 3, callReference: 'CALL_X', status: 'ended' }])).toBeNull();
    expect(pickRingingCall([])).toBeNull();
  });
});

describe('connection servers', () => {
  it('uses the servers the backend sends, TURN included', () => {
    const turn = [{ urls: 'turn:turn.example.com', username: 'u', credential: 'c' }];
    expect(extractIceServers({ data: { iceServers: turn } })).toBe(turn);
  });

  it('falls back to public STUN when it sends none', () => {
    expect(extractIceServers(null)).toEqual(expect.arrayContaining([expect.objectContaining({ urls: expect.stringContaining('stun:') })]));
  });
});

describe('what the call screen says', () => {
  const base = { endReason: null, error: null, isSettingUp: false, isInterrupted: false, duration: 0 };

  it('reads like a phone at every stage', () => {
    expect(callStatusText({ ...base, phase: 'incoming' })).toBe('Incoming call');
    expect(callStatusText({ ...base, phase: 'outgoing', isSettingUp: true })).toBe('Calling…');
    expect(callStatusText({ ...base, phase: 'outgoing' })).toBe('Ringing…');
    expect(callStatusText({ ...base, phase: 'connecting' })).toBe('Connecting…');
    expect(callStatusText({ ...base, phase: 'active', duration: 75 })).toBe('01:15');
    expect(callStatusText({ ...base, phase: 'active', isInterrupted: true })).toBe('Reconnecting…');
  });

  it('says how the call ended', () => {
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'hung_up', duration: 151 })).toBe('Call ended · 02:31');
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'no_answer' })).toBe('No answer');
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'remote_declined' })).toBe('Declined');
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'missed' })).toBe('Missed call');
    expect(
      callStatusText({ ...base, phase: 'ended', endReason: 'failed', error: 'Allow microphone access in Settings to make calls.' }),
    ).toBe('Allow microphone access in Settings to make calls.');
  });
});
