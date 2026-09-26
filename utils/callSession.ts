/**
 * Pure helpers for a call's server records. Identical in both apps.
 */

const LIVE_STATUSES = new Set(['initiated', 'ringing', 'calling', 'pending', 'connecting', 'connected']);

export type CallIds = { callId: string; callReference: string };

function idsOf(call: any): CallIds | null {
  const callId = String(call?.callId ?? call?.call_id ?? call?.id ?? '').trim();
  const callReference = String(call?.callReference ?? call?.call_reference ?? callId).trim();
  return callId && callReference ? { callId, callReference } : null;
}

function timeOf(call: any): number {
  const t = Date.parse(call?.createdAt ?? call?.created_at ?? call?.startedAt ?? '');
  return Number.isFinite(t) ? t : 0;
}

/**
 * The call an incoming-call notification is about, when the notification did
 * not carry its reference: the newest call on the job that is still live.
 * An ended or rejected one means the caller already gave up.
 */
export function pickRingingCall(calls: unknown[]): CallIds | null {
  const live = (Array.isArray(calls) ? calls : [])
    .filter((c: any) => LIVE_STATUSES.has(String(c?.status ?? '').toLowerCase()))
    .sort((a, b) => timeOf(b) - timeOf(a));
  for (const call of live) {
    const ids = idsOf(call);
    if (ids) return ids;
  }
  return null;
}

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * ICE servers from `GET /api/communication/calls/:ref/session`, or public STUN.
 * STUN alone does not get through every mobile network; a TURN server from the
 * backend is what makes calls connect everywhere.
 */
export function extractIceServers(session: unknown): unknown[] {
  const s = (session as any)?.data ?? session;
  const list = s?.iceServers ?? s?.ice_servers ?? s?.rtcConfig?.iceServers;
  return Array.isArray(list) && list.length > 0 ? list : FALLBACK_ICE_SERVERS;
}
