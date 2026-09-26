import { logCallDebug, logCallError, logCallWarn, serializeCallApiError } from '@/utils/callDebugLog';

import { apiClient, extractResponseData } from './client';
import type { Message, SendMessagePayload, SendMessageResponse, GetMessagesResponse, UnreadCountResponse } from './types';

export type { Message, SendMessagePayload, SendMessageResponse, GetMessagesResponse, UnreadCountResponse };

export const communicationService = {
  sendMessage: async (requestId: number, payload: SendMessagePayload): Promise<SendMessageResponse> => {
    const body = { ...payload, type: payload.type ?? 'text' };
    const response = await apiClient.post<{ data: SendMessageResponse }>(`/api/communication/requests/${requestId}/messages`, body);
    const raw = extractResponseData<any>(response);
    const messageData = raw?.data ?? raw?.message ?? raw;
    if (!messageData || typeof messageData !== 'object') throw new Error('Invalid response from send message API.');
    const content = messageData.content ?? messageData.body ?? messageData.text ?? '';
    const safeContent = content == null || String(content).toLowerCase() === 'null' ? '' : String(content);
    return {
      id: messageData.id ?? 0,
      requestId: messageData.requestId ?? requestId,
      senderId: messageData.senderId ?? 0,
      senderType: (messageData.senderType ?? messageData.sender_type ?? 'user') as 'user' | 'provider' | 'company',
      content: safeContent,
      createdAt: messageData.createdAt ?? messageData.created_at ?? new Date().toISOString(),
      updatedAt: messageData.updatedAt ?? messageData.updated_at ?? new Date().toISOString(),
    };
  },

  getMessages: async (requestId: number, options: { limit?: number; offset?: number } = {}): Promise<GetMessagesResponse> => {
    const { limit = 50, offset = 0 } = options;
    const queryParams = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    const endpoint = `/api/communication/requests/${requestId}/messages?${queryParams.toString()}`;
    const response = await apiClient.get<any>(endpoint);
    const responseData = extractResponseData<any>(response);
    if (!responseData) throw new Error('Invalid response from get messages API.');

    // Be tolerant to backend response shape variations:
    // - { messages, total, limit, offset }
    // - { data: { messages, ... } }
    // - { data: [...] }
    // - [...] (array of messages)
    let messages: any[] = [];
    let total = 0;
    let responseOffset = offset;
    let responseLimit = limit;

    if (Array.isArray(responseData)) {
      messages = responseData;
      total = responseData.length;
    } else if (Array.isArray(responseData?.messages)) {
      messages = responseData.messages;
      total = responseData.total ?? messages.length;
      responseOffset = responseData.offset ?? offset;
      responseLimit = responseData.limit ?? limit;
    } else if (Array.isArray(responseData?.data?.messages)) {
      messages = responseData.data.messages;
      total = responseData.data.total ?? responseData.total ?? messages.length;
      responseOffset = responseData.data.offset ?? responseData.offset ?? offset;
      responseLimit = responseData.data.limit ?? responseData.limit ?? limit;
    } else if (Array.isArray(responseData?.data)) {
      messages = responseData.data;
      total = responseData.total ?? messages.length;
      responseOffset = responseData.offset ?? offset;
      responseLimit = responseData.limit ?? limit;
    }

    const hasMore = (responseOffset + messages.length) < total;
    return { messages, total, limit: responseLimit, offset: responseOffset, hasMore };
  },

  markMessagesAsRead: async (requestId: number): Promise<{ message: string }> => {
    const response = await apiClient.patch<any>(`/api/communication/requests/${requestId}/messages/read`);
    const responseData = extractResponseData<any>(response);
    if (!responseData) throw new Error('Invalid response from mark messages as read API.');
    return responseData;
  },

  getUnreadCount: async (requestId: number): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<any>(`/api/communication/requests/${requestId}/messages/unread-count`);
    const responseData = extractResponseData<any>(response);
    if (!responseData) throw new Error('Invalid response from unread count API.');
    return { count: responseData.count || 0 };
  },

  initiateCall: async (requestId: number): Promise<{ callId: string; callReference: string }> => {
    logCallDebug('initiateCall: POST starting', { requestId, path: `/api/communication/requests/${requestId}/calls` });
    try {
      const response = await apiClient.post<any>(`/api/communication/requests/${requestId}/calls`, {});
      if (__DEV__) {
        logCallDebug('initiateCall: HTTP response envelope (keys only)', {
          requestId,
          topLevelKeys: response && typeof response === 'object' ? Object.keys(response as object) : typeof response,
        });
      }
      const raw = extractResponseData<any>(response);
      const data = raw?.data ?? raw;
      const callId = data?.callId ?? data?.call_id ?? data?.id ?? '';
      const callReference = data?.callReference ?? data?.call_reference ?? data?.callId ?? data?.call_id ?? data?.id ?? '';

      if (!callId) {
        logCallWarn('initiateCall: success HTTP body but empty callId - check backend field names', {
          requestId,
          extractedRawSample: raw && typeof raw === 'object' ? JSON.stringify(raw).slice(0, 1200) : raw,
          dataSample: data && typeof data === 'object' ? JSON.stringify(data).slice(0, 800) : data,
        });
      } else {
        logCallDebug('initiateCall: parsed', { requestId, callId, callReference });
      }

      return { callId, callReference };
    } catch (err) {
      logCallError('initiateCall: request failed', { requestId, ...serializeCallApiError(err) });
      throw err;
    }
  },

  updateCallStatus: async (callId: string, status: string): Promise<{ status: string }> => {
    logCallDebug('updateCallStatus: PATCH starting', { callId, status });
    try {
      const response = await apiClient.patch<any>(`/api/communication/calls/${callId}/status`, { status });
      const raw = extractResponseData<any>(response);
      const data = raw?.data ?? raw ?? {};
      const next = data?.status ?? status;
      logCallDebug('updateCallStatus: ok', { callId, status: next });
      return { status: next };
    } catch (err) {
      logCallError('updateCallStatus: failed', { callId, attemptedStatus: status, ...serializeCallApiError(err) });
      throw err;
    }
  },

  getCallHistory: async (
    requestId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ calls: any[]; total: number; hasMore: boolean }> => {
    const { limit = 50, offset = 0 } = options;
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await apiClient.get<any>(`/api/communication/requests/${requestId}/calls?${qs.toString()}`);
    const raw = extractResponseData<any>(response);
    const data = raw?.data ?? raw;
    const calls = Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : [];
    const total = data?.total ?? calls.length;
    return { calls, total, hasMore: (offset + calls.length) < total };
  },

  getCallSession: async (callReference: string): Promise<any> => {
    const enc = encodeURIComponent(callReference);
    const response = await apiClient.get<any>(`/api/communication/calls/${enc}/session`);
    return extractResponseData<any>(response);
  },
};
