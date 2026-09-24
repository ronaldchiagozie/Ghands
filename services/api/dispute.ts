import { apiClient, extractResponseData } from './client';
import type { DisputeMessage } from './types';

export type { DisputeMessage };

function normalizeMessage(raw: any): DisputeMessage {
  return {
    id: Number(raw?.id),
    disputeId: Number(raw?.disputeId ?? raw?.dispute_id),
    senderType: (raw?.senderType ?? raw?.sender_type ?? 'admin') as DisputeMessage['senderType'],
    senderId: Number(raw?.senderId ?? raw?.sender_id ?? 0),
    message: String(raw?.message ?? ''),
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
  };
}

/**
 * The customer's half of dispute chat - `/api/request-service/disputes/:id/messages`.
 * The provider and company sides hit their own routes with the same shape;
 * this app is customer-only, so only this one is implemented here.
 */
export const disputeService = {
  getMessages: async (disputeId: number): Promise<DisputeMessage[]> => {
    const response = await apiClient.get<any>(`/api/request-service/disputes/${disputeId}/messages`);
    const raw = extractResponseData<any>(response);
    const rows: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : [];
    return rows.map(normalizeMessage);
  },

  sendMessage: async (disputeId: number, message: string): Promise<DisputeMessage> => {
    const response = await apiClient.post<any>(`/api/request-service/disputes/${disputeId}/messages`, {
      message: message.trim(),
    });
    return normalizeMessage(extractResponseData<any>(response));
  },
};
