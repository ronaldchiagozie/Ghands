import { apiClient, extractResponseData } from './client';

export type SubmitSupportContactPayload = {
  name: string;
  email: string;
  message: string;
};

export type SubmitSupportContactResponse = {
  message?: string;
  id?: string | number;
};

export const supportService = {
  submitContactMessage: async (
    payload: SubmitSupportContactPayload,
  ): Promise<SubmitSupportContactResponse> => {
    const response = await apiClient.post<any>('/api/support/contact', payload);
    const data = extractResponseData<any>(response);
    return {
      message: data?.message ?? data?.data?.message,
      id: data?.id ?? data?.ticketId ?? data?.data?.id,
    };
  },
};
