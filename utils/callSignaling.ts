import { io } from 'socket.io-client';

import { API_BASE_URL } from '@/lib/apiConfig';
import { authService } from '@/services/authService';
import type { SignalingSocket } from '@/utils/callEngine';

/**
 * A socket to the backend's socket.io server for one call: same host as the
 * REST API, default path, the session token in the handshake.
 */
export async function openCallSocket(): Promise<SignalingSocket & { on(event: 'connect_error', h: (e: Error) => void): void }> {
  const token = await authService.getAuthToken();
  if (!token) throw new Error('Please sign in again to make calls.');
  return io(API_BASE_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 4000,
    timeout: 15000,
  }) as any;
}
