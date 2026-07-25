import { logRatingDebug, logRatingError } from '@/utils/ratingDebugLog';
import { serializeCallApiError } from '@/utils/callDebugLog';
import { isAlreadyReviewedApiError } from '@/utils/reviewSync';

import { AuthError } from '../../utils/errors';
import { apiClient, extractResponseData } from './client';
import type {
  ServiceCategory,
  CreateServiceRequestPayload,
  CreateServiceRequestResponse,
  UpdateJobDetailsPayload,
  UpdateJobDetailsResponse,
  UpdateDateTimePayload,
  UpdateDateTimeResponse,
  ServiceRequest,
  QuotationWithProvider,
} from './types';

export type {
  ServiceCategory,
  CreateServiceRequestPayload,
  CreateServiceRequestResponse,
  UpdateJobDetailsPayload,
  UpdateJobDetailsResponse,
  UpdateDateTimePayload,
  UpdateDateTimeResponse,
  ServiceRequest,
  QuotationWithProvider,
};

function firstPresent(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function parseMoneyValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[₦,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeServiceRequestRecord(requestData: ServiceRequest | null | undefined): ServiceRequest {
  if (!requestData) return requestData as unknown as ServiceRequest;
  if (requestData.nearbyProviders && !Array.isArray(requestData.nearbyProviders)) requestData.nearbyProviders = [];
  if (requestData.status && typeof requestData.status === 'string') {
    (requestData as any).status = requestData.status.toLowerCase();
  }
  const raw = requestData as any;
  const vr = raw.visitRequest ?? raw.visit_request;
  const rawVisitStatus =
    vr?.logisticsStatus ??
    vr?.logistics_status ??
    vr?.visitStatus ??
    vr?.visit_status ??
    raw.logisticsStatus ??
    raw.logistics_status ??
    raw.visitStatus ??
    raw.visit_status;
  const normalizedVisitStatus = typeof rawVisitStatus === 'string' ? rawVisitStatus.toLowerCase() : undefined;
  const mappedVisitStatus =
    normalizedVisitStatus === 'declined' || normalizedVisitStatus === 'rejected' ? 'cancelled' : normalizedVisitStatus;
  const rawVisitCost = firstPresent(
    vr?.logisticsCost,
    vr?.logistics_cost,
    vr?.logisticsFee,
    vr?.logistics_fee,
    vr?.visitLogisticsCost,
    vr?.visit_logistics_cost,
    vr?.visitFee,
    vr?.visit_fee,
    vr?.inspectionFee,
    vr?.inspection_fee,
    vr?.amount,
    raw.logisticsCost,
    raw.logistics_cost,
    raw.logisticsFee,
    raw.logistics_fee,
    raw.visitLogisticsCost,
    raw.visit_logistics_cost,
    raw.visitFee,
    raw.visit_fee,
    raw.inspectionFee,
    raw.inspection_fee,
    raw.amount
  );
  const visitCost = parseMoneyValue(rawVisitCost);
  const scheduledDate = vr?.scheduledDate ?? vr?.scheduled_date ?? raw.scheduledDate ?? raw.scheduled_date;
  const scheduledTime = vr?.scheduledTime ?? vr?.scheduled_time ?? raw.scheduledTime ?? raw.scheduled_time;
  const hasNested = vr && (scheduledDate ?? scheduledTime ?? rawVisitCost);
  const hasFlat = scheduledDate ?? scheduledTime ?? rawVisitCost;
  const hasVisitRequestedAt = !!(raw.visitRequestedAt ?? raw.visit_requested_at ?? vr?.requestedAt ?? vr?.requested_at);
  const hasVisitStatus = !!mappedVisitStatus;
  if (hasNested || hasFlat || hasVisitRequestedAt || hasVisitStatus) {
    (requestData as any).visitRequest = {
      scheduledDate,
      scheduledTime,
      logisticsCost: visitCost,
      logisticsStatus: mappedVisitStatus,
      requestedAt: vr?.requestedAt ?? vr?.requested_at ?? raw.visitRequestedAt ?? raw.visit_requested_at,
      declinedBy: vr?.declinedBy ?? vr?.declined_by ?? raw.visitDeclinedBy ?? raw.visit_declined_by,
      cancelledBy: vr?.cancelledBy ?? vr?.cancelled_by ?? raw.visitCancelledBy ?? raw.visit_cancelled_by,
    };
    if (__DEV__) {
      console.log('[VisitRequestNormalize]', {
        requestId: raw.id ?? raw.requestId ?? raw.request_id,
        rawVisitCost,
        normalizedVisitCost: visitCost,
        visitRequest: (requestData as any).visitRequest,
        rawVisitKeys: vr ? Object.keys(vr) : [],
      });
    }
  }
  return requestData;
}

function parseCategoriesResponse(response: unknown): ServiceCategory[] {
  if (Array.isArray((response as any)?.data)) return (response as any).data;
  const nestedData = (response as any)?.data?.data;
  return Array.isArray(nestedData) ? nestedData : [];
}

export const serviceRequestService = {
  getCategories: async (): Promise<ServiceCategory[]> => {
    try {
      const response = await apiClient.get<{ data?: ServiceCategory[] | { data: ServiceCategory[] }; success?: boolean }>(
        '/api/request-service/categories',
        { skipAuth: true }
      );
      const categories = parseCategoriesResponse(response);
      return categories;
    } catch (error: any) {
      throw error;
    }
  },

  searchCategories: async (query: string): Promise<ServiceCategory[]> => {
    if (query.length < 2) return [];
    try {
      const response = await apiClient.get<{ data?: ServiceCategory[] | { data: ServiceCategory[] }; success?: boolean }>(
        `/api/request-service/categories/search?query=${encodeURIComponent(query)}`,
        { skipAuth: true }
      );
      const categories = parseCategoriesResponse(response);
      return categories;
    } catch (error: any) {
      throw error;
    }
  },

  createRequest: async (payload: CreateServiceRequestPayload): Promise<CreateServiceRequestResponse> => {
    try {
      const requestPayload: any = { categoryName: payload.categoryName };
      if (payload.jobTitle?.trim()) requestPayload.jobTitle = payload.jobTitle.trim();
      if (payload.description?.trim()) requestPayload.description = payload.description.trim();
      if (payload.comment?.trim()) requestPayload.comment = payload.comment.trim();
      const response = await apiClient.post<any>('/api/request-service/requests', requestPayload);
      const responseData = (response as any).data?.data || (response as any).data || response;
      const requestId = responseData.requestId || responseData.id || responseData.data?.requestId;
      if (!requestId) throw new Error('Invalid response from API: requestId not found');
      const id = typeof requestId === 'number' ? requestId : parseInt(requestId, 10);
      return {
        requestId: id,
        categoryName: responseData.categoryName || payload.categoryName,
        status: responseData.status || 'pending',
        message: responseData.message || 'Service request created successfully',
      };
    } catch (error) {
      throw error;
    }
  },

  updateJobDetails: async (requestId: number, payload: UpdateJobDetailsPayload): Promise<UpdateJobDetailsResponse> => {
    try {
      const response = await apiClient.put<any>(`/api/request-service/requests/${requestId}/details`, payload);
      const responseData = (response as any).data?.data || (response as any).data || response;
      if (responseData.nearbyProviders && !Array.isArray(responseData.nearbyProviders)) {
        responseData.nearbyProviders = [];
      }
      return responseData;
    } catch (error) {
      throw error;
    }
  },

  updateDateTime: async (requestId: number, payload: UpdateDateTimePayload): Promise<UpdateDateTimeResponse> => {
    return extractResponseData<UpdateDateTimeResponse>(
      await apiClient.put<any>(`/api/request-service/requests/${requestId}/date-time`, payload)
    );
  },

  getRequestDetails: async (requestId: number): Promise<ServiceRequest> => {
    try {
      const response = await apiClient.get<any>(`/api/request-service/requests/${requestId}`);
      const requestData = extractResponseData<ServiceRequest>(response);
      return normalizeServiceRequestRecord(requestData);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Client job detail: same as getRequestDetails, but if GET /requests/:id returns 5xx (backend crash),
   * try GET /requests (list) and use the matching row — often still works when single-resource handler breaks.
   * `usedListFallback` is true when the single GET failed and list data was used (caller should warn user).
   */
  getRequestDetailsWithListFallback: async (
    requestId: number
  ): Promise<{ request: ServiceRequest; usedListFallback: boolean }> => {
    const id = Number(requestId);
    try {
      const request = await serviceRequestService.getRequestDetails(id);
      return { request, usedListFallback: false };
    } catch (err: any) {
      const st = err?.status;
      const isServerError = typeof st === 'number' && st >= 500 && st < 600;
      if (!isServerError) throw err;
      try {
        const list = await serviceRequestService.getUserRequests();
        const found = (list || []).find((r: any) => Number(r?.id) === id);
        if (found) {
          return {
            request: normalizeServiceRequestRecord({ ...found }),
            usedListFallback: true,
          };
        }
      } catch {
        /* keep original error */
      }
      throw err;
    }
  },

  getUserRequests: async (status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'): Promise<ServiceRequest[]> => {
    try {
      const url = status ? `/api/request-service/requests?status=${status}` : `/api/request-service/requests`;
      const response = await apiClient.get<any>(url);
      let requests: ServiceRequest[] = [];
      if (Array.isArray(response)) requests = response;
      else if ((response as any)?.data) {
        if (Array.isArray((response as any).data)) requests = (response as any).data;
        else if (Array.isArray((response as any).data?.data)) requests = (response as any).data.data;
      }
      return requests.map((r: any) => ({ ...r, nearbyProviders: Array.isArray(r.nearbyProviders) ? r.nearbyProviders : [] }));
    } catch (error) {
      throw error;
    }
  },

  cancelRequest: async (requestId: number): Promise<{ requestId: number; status: string; message: string }> => {
    const response = await apiClient.delete<any>(`/api/request-service/requests/${requestId}`);
    const data = extractResponseData<any>(response);
    const inner = data?.data?.data ?? data?.data ?? data ?? {};
    return {
      requestId: Number(inner.requestId ?? inner.id ?? requestId) || requestId,
      status: String(inner.status ?? 'cancelled'),
      message: String(inner.message ?? 'Request cancelled.'),
    };
  },

  getAcceptedProviders: async (requestId: number): Promise<Array<{
    provider: { id: number; name: string; verified: boolean; age: number; phoneNumber: string; email: string; location: { address: string; city: string; state: string } };
    acceptance: { id: number; acceptedAt: string };
    distanceKm: number;
    minutesAway: number;
  }>> => {
    try {
      const response = await apiClient.get<any>(`/api/request-service/requests/${requestId}/accepted-providers`);
      let providers: any[] = [];
      if (Array.isArray(response)) providers = response;
      else if ((response as any)?.data) {
        if (Array.isArray((response as any).data)) providers = (response as any).data;
        else if (Array.isArray((response as any).data?.data)) providers = (response as any).data.data;
      }
      return (providers || []).filter((p: any) => {
        const s = (p.acceptance?.status ?? p.status ?? '').toString().toLowerCase();
        return s !== 'rejected' && s !== 'declined';
      });
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      if (error?.status === 400 && (msg.includes('provider.image') || msg.includes('does not exist'))) return [];
      throw error;
    }
  },

  selectProvider: async (requestId: number, providerId: number): Promise<{
    requestId: number; status: string; provider: { id: number; name: string; phoneNumber: string; email: string }; message: string;
  }> => {
    const response = await apiClient.post<any>(`/api/request-service/requests/${requestId}/select-provider`, { providerId });
    const d = extractResponseData<any>(response);
    return { requestId: d.requestId || requestId, status: d.status || 'accepted', provider: d.provider || {}, message: d.message || 'Provider selected successfully' };
  },

  getQuotations: async (requestId: number): Promise<QuotationWithProvider[]> => {
    const response = await apiClient.get<any>(`/api/request-service/requests/${requestId}/quotations`);
    const raw = extractResponseData<any>(response);
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.quotations)) return raw.quotations;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  },

  acceptQuotation: async (quotationId: number): Promise<{ quotationId: number; requestId: number; total: number; status: 'accepted'; message: string }> => {
    const response = await apiClient.post<any>(`/api/request-service/quotations/${quotationId}/accept`);
    return (response as any).data;
  },

  rejectQuotation: async (quotationId: number): Promise<{ quotationId: number; status: 'rejected'; message: string }> => {
    const response = await apiClient.post<any>(`/api/request-service/quotations/${quotationId}/reject`);
    return (response as any).data;
  },

  completeServiceRequest: async (requestId: number): Promise<{ id: number; status: 'completed'; message: string }> => {
    const response = await apiClient.put<any>(`/api/request-service/requests/${requestId}/complete`);
    return (response as any).data;
  },

  declineVisit: async (requestId: number): Promise<{ requestId: number; visitStatus: string; message: string }> => {
    if (__DEV__) {
      console.log('[DeclineVisit] POST', {
        requestId,
        endpoint: `/api/request-service/requests/${requestId}/decline-visit`,
      });
    }
    const response = await apiClient.post<any>(`/api/request-service/requests/${requestId}/decline-visit`, {});
    if (__DEV__) {
      console.log('[DeclineVisit] raw response', {
        requestId,
        response,
      });
    }
    const data = extractResponseData<any>(response);
    if (__DEV__) {
      console.log('[DeclineVisit] extracted response', {
        requestId,
        data,
      });
    }
    return data ?? { requestId, visitStatus: 'declined', message: 'Visit declined.' };
  },

  reviewProvider: async (
    requestId: number,
    payload: { rating: number; comment?: string }
  ): Promise<any> => {
    const path = `/api/request-service/requests/${requestId}/review`;
    logRatingDebug('reviewProvider: POST', {
      path,
      requestId,
      rating: payload.rating,
      hasComment: !!payload.comment,
      commentLength: payload.comment?.length ?? 0,
    });
    try {
      const response = await apiClient.post<any>(path, payload);
      if (__DEV__) {
        const topKeys =
          response && typeof response === 'object' ? Object.keys(response as object) : typeof response;
        logRatingDebug('reviewProvider: response ok', { requestId, topLevelKeys: topKeys });
      }
      const data = extractResponseData<any>(response);
      const out = data ?? (response as any)?.data ?? response;
      logRatingDebug('reviewProvider: parsed body', {
        requestId,
        hasData: out != null,
      });
      return out;
    } catch (err) {
      if (isAlreadyReviewedApiError(err)) {
        logRatingDebug('reviewProvider: already reviewed (duplicate)', { requestId, path });
      } else {
        logRatingError('reviewProvider: failed', {
          requestId,
          path,
          ...serializeCallApiError(err),
        });
      }
      throw err;
    }
  },
};
