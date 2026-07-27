import { apiClient, extractResponseData } from './client';
import type { LocationData } from './types';
import { authService } from '@/services/authService';
import { API_BASE_URL } from '@/lib/apiConfig';
import { guessMimeAndName, uploadImageUris } from '@/utils/aiImageUpload';

export type AiResponseType = 'text' | 'estimate' | 'suggestion';

export type AiEstimate = {
  minNgn: number;
  maxNgn: number;
  disclaimer?: string;
};

export type AiBookingSuggestion = {
  serviceType: string;
  serviceDisplayName?: string;
  jobTitle: string;
  description: string;
  askToBook?: boolean;
};

export type AiStatus = {
  available: boolean;
  botName: string;
};

export type AiChatRequest = {
  message: string;
  conversationId?: number;
  /** Public URLs after upload — sent when the chat API accepts image references. */
  imageUrls?: string[];
};

export type AiChatResponse = {
  conversationId: number;
  message: string;
  responseType: AiResponseType;
  estimate?: AiEstimate;
  suggestion?: AiBookingSuggestion;
};

export type AiConversationSummary = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  responseType: AiResponseType | null;
  metadata: {
    estimate?: AiEstimate;
    suggestion?: AiBookingSuggestion;
  } | null;
  createdAt: string;
};

export type AiConversationDetail = {
  conversation: AiConversationSummary;
  messages: AiConversationMessage[];
};

export type AiQuickBookingRequest = {
  categoryName: string;
  jobTitle: string;
  description: string;
  conversationId?: number;
  useSavedLocation?: boolean;
  location?: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
};

export type AiQuickBookingProvider = {
  id: number;
  name: string;
  distanceKm: number;
  minutesAway: number;
};

export type AiQuickBookingResponse = {
  requestId: number;
  categoryName: string;
  jobTitle: string;
  description: string;
  status: string;
  location: string;
  locationDetails?: LocationData;
  nearbyProviderCount?: number;
  nearbyProviders?: AiQuickBookingProvider[];
  conversationId?: number;
};

function unwrapAiData<T>(response: unknown): T {
  const layer = extractResponseData<any>(response);
  if (layer?.data !== undefined && layer?.data !== null) {
    return layer.data as T;
  }
  return layer as T;
}

function extractApiError(response: unknown): string | undefined {
  const layer = extractResponseData<any>(response);
  return layer?.error ?? layer?.data?.error;
}

export const aiService = {
  getStatus: async (): Promise<AiStatus> => {
    const response = await apiClient.get<any>('/api/ai/status');
    return unwrapAiData<AiStatus>(response);
  },

  sendMessage: async (payload: AiChatRequest): Promise<AiChatResponse> => {
    const response = await apiClient.post<any>('/api/ai/chat', payload);
    return unwrapAiData<AiChatResponse>(response);
  },

  /**
   * Sends chat with local images: tries multipart on `/api/ai/chat`, then uploaded URLs in JSON.
   */
  sendMessageWithImages: async (payload: {
    message: string;
    conversationId?: number;
    localUris: string[];
  }): Promise<AiChatResponse> => {
    const token = await authService.getAuthToken();
    if (!token) {
      throw new Error('Please sign in to send photos to Handy.');
    }

    if (payload.localUris.length > 0) {
      const formData = new FormData();
      formData.append('message', payload.message);
      if (payload.conversationId != null) {
        formData.append('conversationId', String(payload.conversationId));
      }
      payload.localUris.forEach((uri, index) => {
        const { name, type } = guessMimeAndName(uri, index);
        formData.append('images', { uri, name, type } as unknown as Blob);
      });

      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (response.ok) {
          const json = await response.json();
          return unwrapAiData<AiChatResponse>(json);
        }
      } catch {
        /* multipart not supported — fall back below */
      }
    }

    const imageUrls =
      payload.localUris.length > 0 ? await uploadImageUris(payload.localUris) : undefined;

    return aiService.sendMessage({
      message: payload.message,
      conversationId: payload.conversationId,
      ...(imageUrls?.length ? { imageUrls } : {}),
    });
  },

  listConversations: async (limit = 20): Promise<AiConversationSummary[]> => {
    const response = await apiClient.get<any>(
      `/api/ai/conversations?limit=${encodeURIComponent(limit)}`
    );
    const data = unwrapAiData<AiConversationSummary[]>(response);
    return Array.isArray(data) ? data : [];
  },

  getConversationMessages: async (conversationId: number): Promise<AiConversationDetail> => {
    const response = await apiClient.get<any>(
      `/api/ai/conversations/${conversationId}/messages`
    );
    return unwrapAiData<AiConversationDetail>(response);
  },

  deleteConversation: async (conversationId: number): Promise<void> => {
    await apiClient.delete<any>(`/api/ai/conversations/${conversationId}`);
  },

  quickBooking: async (payload: AiQuickBookingRequest): Promise<AiQuickBookingResponse> => {
    const response = await apiClient.post<any>('/api/ai/quick-booking', payload);
    const success = (response as any)?.success;
    if (success === false) {
      const error = extractApiError(response) || 'Failed to create booking';
      const err = new Error(error) as Error & { details?: unknown };
      err.details = response;
      throw err;
    }
    return unwrapAiData<AiQuickBookingResponse>(response);
  },
};
