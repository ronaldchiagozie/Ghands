import { cacheDevAuthTokenForRole } from '../../utils/devAuthTokens';
import { AuthError } from '../../utils/errors';
import { saveCachedVisitRequest } from '../../utils/visitRequestCache';
import { isDuplicateActionError } from '../../utils/idempotentSubmit';
import { extractUserIdFromToken } from '../../utils/tokenUtils';
import { authService as authServiceInstance } from '../authService';
import { apiClient, extractResponseData } from './client';
import type {
  Provider,
  ProviderSignupPayload,
  ProviderSignupResponse,
  ProviderLoginPayload,
  ProviderLoginResponse,
  ProviderLocationPayload,
  ProviderQuotationListItem,
  Quotation,
  QuotationWithProvider,
  SendQuotationPayload,
  SendQuotationResponse,
  ServiceRequest,
  AvailableRequest,
  NearbyProvider,
} from './types';
import type { SavedLocation } from './types';

/**
 * Many backends wrap job arrays as data.data, data.requests, etc.
 * Without this, the provider app treats the payload as non-array and shows zero jobs.
 */
function normalizeProviderRequestList(raw: unknown): ServiceRequest[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as ServiceRequest[];

  const r = raw as Record<string, unknown>;
  const tryArray = (v: unknown): ServiceRequest[] | null =>
    Array.isArray(v) ? (v as ServiceRequest[]) : null;

  let list = tryArray(r.data);
  if (list) return list.map(normalizeProviderRequestRecord);

  list = tryArray((r.data as any)?.data);
  if (list) return list.map(normalizeProviderRequestRecord);

  const inner = r.data as Record<string, unknown> | undefined;
  if (inner && typeof inner === 'object') {
    list =
      tryArray(inner.requests) ||
      tryArray(inner.items) ||
      tryArray(inner.results) ||
      tryArray(inner.jobs) ||
      tryArray(inner.content);
    if (list) return list.map(normalizeProviderRequestRecord);
  }

  list = tryArray(r.requests) || tryArray(r.items) || tryArray(r.results);
  return (list || []).map(normalizeProviderRequestRecord);
}

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

function normalizeProviderRequestRecord(requestData: ServiceRequest): ServiceRequest {
  if (!requestData) return requestData;
  const raw = requestData as any;
  const vr = raw.visitRequest ?? raw.visit_request;
  const rawVisitStatus = firstPresent(
    vr?.logisticsStatus,
    vr?.logistics_status,
    vr?.visitStatus,
    vr?.visit_status,
    raw.logisticsStatus,
    raw.logistics_status,
    raw.visitStatus,
    raw.visit_status
  );
  const mappedVisitStatus =
    typeof rawVisitStatus === 'string'
      ? rawVisitStatus.toLowerCase().replace('rejected', 'cancelled').replace('declined', 'cancelled')
      : undefined;
  const rawVisitCost = firstPresent(
    vr?.logisticsCost,
    vr?.logistics_cost,
    vr?.logisticsFee,
    vr?.logistics_fee,
    vr?.visitLogisticsCost,
    vr?.visit_logistics_cost,
    vr?.visitFee,
    vr?.visit_fee,
    raw.logisticsCost,
    raw.logistics_cost,
    raw.logisticsFee,
    raw.logistics_fee,
    raw.visitLogisticsCost,
    raw.visit_logistics_cost,
    raw.visitFee,
    raw.visit_fee
  );
  const scheduledDate = firstPresent(vr?.scheduledDate, vr?.scheduled_date, raw.scheduledDate, raw.scheduled_date) as string | undefined;
  const scheduledTime = firstPresent(vr?.scheduledTime, vr?.scheduled_time, raw.scheduledTime, raw.scheduled_time) as string | undefined;
  const requestedAt = firstPresent(vr?.requestedAt, vr?.requested_at, raw.visitRequestedAt, raw.visit_requested_at) as string | undefined;
  if (vr || scheduledDate || scheduledTime || requestedAt || mappedVisitStatus || rawVisitCost) {
    raw.visitRequest = {
      scheduledDate,
      scheduledTime,
      logisticsCost: parseMoneyValue(rawVisitCost),
      logisticsStatus: mappedVisitStatus,
      requestedAt,
      declinedBy: firstPresent(vr?.declinedBy, vr?.declined_by, raw.visitDeclinedBy, raw.visit_declined_by),
      cancelledBy: firstPresent(vr?.cancelledBy, vr?.cancelled_by, raw.visitCancelledBy, raw.visit_cancelled_by),
    };
  }
  return requestData;
}

export type {
  Provider,
  ProviderSignupPayload,
  ProviderSignupResponse,
  ProviderLoginPayload,
  ProviderLoginResponse,
  ProviderLocationPayload,
  ProviderQuotationListItem,
  AvailableRequest,
};

const providerService = {
  signup: async (payload: ProviderSignupPayload): Promise<ProviderSignupResponse> => {
    const response = await apiClient.post<any>('/api/provider/signup', payload, { skipAuth: true });
    const token = response?.data?.data?.token || response?.data?.token || response?.token;
    const providerData = response?.data?.data || response?.data || response;
    const providerId = providerData?.id || (response as any)?.id || response?.data?.id;
    if (token) {
      await authServiceInstance.setAuthToken(token);
      await cacheDevAuthTokenForRole('provider', token);
      const { schedulePushSyncAfterAuth } = await import('@/utils/pushNotifications');
      schedulePushSyncAfterAuth();
    }
    if (providerId) await authServiceInstance.setUserId(providerId);
    else if (token) {
      const id = extractUserIdFromToken(token);
      if (id) await authServiceInstance.setUserId(id);
    }
    return {
      id: providerId || (token ? extractUserIdFromToken(token) : undefined) || 0,
      name: providerData?.name || payload.name,
      email: providerData?.email || payload.email,
      phoneNumber: providerData?.phoneNumber || payload.phoneNumber,
      verified: providerData?.verified || false,
      age: providerData?.age || payload.age,
      token: token || '',
      message: providerData?.message || 'Provider registered successfully',
    };
  },

  login: async (payload: ProviderLoginPayload): Promise<ProviderLoginResponse> => {
    const response = await apiClient.post<any>(
      '/api/provider/login',
      { email: payload.email.trim().toLowerCase(), password: payload.password },
      { skipAuth: true }
    );
    const token = response?.data?.data?.token || response?.data?.token || response?.token;
    const providerData = response?.data?.data || response?.data || response;
    const providerId = providerData?.id || providerData?.companyId || (response as any)?.id || response?.data?.id;
    if (!token) throw new Error('Login failed: No token received from server.');
    await authServiceInstance.setAuthToken(token);
    await cacheDevAuthTokenForRole('provider', token);
    const { schedulePushSyncAfterAuth } = await import('@/utils/pushNotifications');
    schedulePushSyncAfterAuth();
    let finalProviderId: number | undefined = undefined;
    if (providerId) {
      finalProviderId = typeof providerId === 'number' ? providerId : parseInt(providerId.toString(), 10);
      await authServiceInstance.setCompanyId(finalProviderId);
    } else if (token) {
      const id = extractUserIdFromToken(token);
      if (id) {
        finalProviderId = id;
        await authServiceInstance.setCompanyId(finalProviderId);
      }
    }
    if (finalProviderId) await authServiceInstance.setUserId(finalProviderId);
    return {
      id: finalProviderId || providerId || 0,
      name: providerData?.name || providerData?.companyName || '',
      email: providerData?.email || providerData?.companyEmail || payload.email,
      phoneNumber: providerData?.phoneNumber || providerData?.companyPhoneNumber,
      verified: providerData?.verified || false,
      age: providerData?.age || 0,
      latitude: providerData?.latitude,
      longitude: providerData?.longitude,
      formattedAddress: providerData?.formattedAddress,
      token,
      message: providerData?.message || 'Login successful',
    };
  },

  getProvider: async (providerId?: number): Promise<Provider> => {
    const response = await apiClient.get<any>('/api/provider');
    const providerData = extractResponseData<Provider>(response);
    if (providerData?.categories && !Array.isArray(providerData.categories)) providerData.categories = [];
    return providerData;
  },

  /**
   * Collect image URLs from profile payloads (strings, objects, or nested analytics-style arrays).
   */
  normalizeRecentWorkUrls: (...sources: unknown[]): string[] => {
    const out: string[] = [];
    const pushUrl = (u: unknown) => {
      if (typeof u === 'string') {
        const t = u.trim();
        if (/^https?:\/\//i.test(t)) out.push(t);
      }
    };
    const walk = (node: unknown) => {
      if (node == null) return;
      if (typeof node === 'string') {
        pushUrl(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node === 'object') {
        const o = node as Record<string, unknown>;
        pushUrl(o.url);
        pushUrl(o.image);
        pushUrl(o.photo);
        pushUrl(o.src);
        pushUrl(o.thumbnail);
        if (Array.isArray(o.images)) walk(o.images);
      }
    };
    for (const s of sources) walk(s);
    return [...new Set(out)];
  },

  getPublicProfile: async (
    providerId: number
  ): Promise<{
    provider: {
      id: number;
      name: string | null;
      professionTitle: string | null;
      isOnline: boolean;
      rating: number;
      totalReviews: number;
      milesAway: number | null;
      jobsDone: number;
      responseTimeMinutes: number | null;
      onTimeRate: number | null;
      skills: string[];
      recentWork: string[];
      about: string | null;
    };
    reviews: Array<any>;
  }> => {
    const response = await apiClient.get<any>(`/api/provider/${providerId}/profile`);
    const raw = extractResponseData<any>(response);
    const nested = raw?.data?.data ?? raw?.data ?? raw ?? {};
    const provider = nested?.provider ?? nested ?? {};

    const reviewLists: unknown[] = [
      nested?.reviews,
      nested?.latestReviews,
      provider?.reviews,
      provider?.latestReviews,
      nested?.ratings?.latestReviews,
    ];
    let reviews: any[] = [];
    for (const list of reviewLists) {
      if (Array.isArray(list) && list.length > 0) {
        reviews = list;
        break;
      }
    }
    if (reviews.length === 0) {
      for (const list of reviewLists) {
        if (Array.isArray(list)) {
          reviews = list;
          break;
        }
      }
    }

    const recentWorkRaw = providerService.normalizeRecentWorkUrls(
      provider.recentWork,
      provider.recent_work,
      provider.portfolio,
      provider.gallery,
      provider.workImages,
      nested.recentWork,
      nested.recent_work,
      nested.portfolio,
      nested.gallery
    );

    const skillSource =
      Array.isArray(provider.skills) && provider.skills.length > 0
        ? provider.skills
        : Array.isArray(provider.categories) && provider.categories.length > 0
          ? provider.categories
          : Array.isArray(nested.categories)
            ? nested.categories
            : [];

    const ratingsBlock = nested.ratings ?? provider.ratings ?? {};
    const avgFromNested = Number(
      ratingsBlock.averageRating ?? ratingsBlock.average_rating ?? NaN
    );
    const totalFromNested = Number(
      ratingsBlock.totalReviews ?? ratingsBlock.total_reviews ?? NaN
    );

    let rating = Number(provider.rating ?? provider.averageRating ?? 0) || 0;
    let totalReviews = Number(provider.totalReviews ?? provider.total_reviews ?? 0) || 0;
    if (!rating && !Number.isNaN(avgFromNested) && avgFromNested > 0) rating = avgFromNested;
    if (!totalReviews && !Number.isNaN(totalFromNested) && totalFromNested > 0) {
      totalReviews = totalFromNested;
    }

    return {
      provider: {
        id: Number(provider.id ?? providerId),
        name: provider.name ?? null,
        professionTitle: provider.professionTitle ?? provider.profession_title ?? null,
        isOnline: provider.isOnline ?? provider.is_online ?? false,
        rating,
        totalReviews,
        milesAway: provider.milesAway ?? provider.miles_away ?? null,
        jobsDone: Number(provider.jobsDone ?? provider.jobs_done ?? 0) || 0,
        responseTimeMinutes:
          provider.responseTimeMinutes ?? provider.response_time_minutes ?? null,
        onTimeRate: provider.onTimeRate ?? provider.on_time_rate ?? null,
        skills: skillSource,
        recentWork: recentWorkRaw,
        about: provider.about ?? null,
      },
      reviews,
    };
  },

  /**
   * Same shape as getProviderAnalytics but scoped to a provider (for clients viewing a profile).
   * Returns null if the route is missing or the call fails.
   */
  tryGetPublicProviderAnalytics: async (
    providerId: number
  ): Promise<{
    latestReviews: any[];
    ratings?: { averageRating?: number; totalReviews?: number };
  } | null> => {
    try {
      const response = await apiClient.get<any>(`/api/provider/${providerId}/analytics`);
      const raw = extractResponseData<any>(response);
      const nested = raw?.data?.data ?? raw?.data ?? raw ?? {};
      return {
        latestReviews: Array.isArray(nested.latestReviews) ? nested.latestReviews : [],
        ratings: nested.ratings,
      };
    } catch {
      return null;
    }
  },

  /**
   * Public list of reviews for a provider (if supported by the API).
   */
  tryGetPublicProviderReviews: async (
    providerId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any[] | null> => {
    const { limit = 20, offset = 0 } = options;
    try {
      const response = await apiClient.get<any>(
        `/api/provider/${providerId}/reviews?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`
      );
      const raw = extractResponseData<any>(response);
      const nested = raw?.data?.data ?? raw?.data ?? raw ?? {};
      const list = nested.reviews ?? nested.data ?? nested;
      return Array.isArray(list) ? list : [];
    } catch {
      return null;
    }
  },

  /**
   * Public provider gallery / profile images.
   * Expected: `{ "image": ["https://..."] }` (may be nested under data).
   */
  getProviderPublicImages: async (providerId: number): Promise<string[]> => {
    try {
      const response = await apiClient.get<any>(`/api/provider/${providerId}/image`);
      const raw = extractResponseData<any>(response);
      const nested = raw?.data?.data ?? raw?.data ?? raw;
      const arr = nested?.image ?? nested?.images ?? nested?.data?.image;
      const urls: string[] = [];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string' && item.trim()) {
            urls.push(item.trim());
          }
        }
      } else if (typeof arr === 'string' && arr.trim()) {
        urls.push(arr.trim());
      }
      return urls.filter((u) => /^https?:\/\//i.test(u));
    } catch {
      return [];
    }
  },

  updateLocation: async (payload: ProviderLocationPayload): Promise<{ providerId: number; location: SavedLocation; message: string }> => {
    const token = await authServiceInstance.getAuthToken();
    if (!token) throw new AuthError('Authentication required. Please sign in again.');
    const requestBody: any = {};
    if (payload.placeId?.trim()) requestBody.placeId = payload.placeId.trim();
    else if (payload.latitude !== undefined && payload.longitude !== undefined && !isNaN(payload.latitude) && !isNaN(payload.longitude)) {
      requestBody.latitude = payload.latitude;
      requestBody.longitude = payload.longitude;
    } else if (payload.address?.trim()) {
      const clean = payload.address.trim().replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) throw new Error('Address is required and cannot be empty');
      requestBody.address = clean;
    } else throw new Error('Either placeId, coordinates (latitude/longitude), or address must be provided');
    const response = await apiClient.put<any>('/api/provider/location', requestBody);
    return (response as any).data;
  },

  addCategories: async (categories: string[]): Promise<{ providerId: number; categories: string[]; message: string }> => {
    const response = await apiClient.post<any>('/api/provider/categories', { categories });
    return (response as any).data;
  },

  getServices: async (providerId?: number): Promise<{ id: number; categoryName: string }[]> => {
    const provider = await providerService.getProvider(providerId);
    if (provider.categories && Array.isArray(provider.categories)) {
      return provider.categories.map((categoryName: string, i: number) => ({ id: i + 1, categoryName }));
    }
    return [];
  },

  getNearbyProviders: async (categoryName: string, latitude: number, longitude: number, maxDistanceKm = 50): Promise<NearbyProvider[]> => {
    try {
      const response = await apiClient.get<any>(
        `/api/provider/nearby?categoryName=${encodeURIComponent(categoryName)}&latitude=${latitude}&longitude=${longitude}&maxDistanceKm=${maxDistanceKm}`,
        { skipAuth: true }
      );
      return extractResponseData<NearbyProvider[]>(response) || [];
    } catch {
      return [];
    }
  },

  getAvailableRequests: async (maxDistanceKm = 50): Promise<AvailableRequest[]> => {
    try {
      const response = await apiClient.get<any>(`/api/provider/requests/available?maxDistanceKm=${maxDistanceKm}`);
      return normalizeProviderRequestList(response) as AvailableRequest[];
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      if (__DEV__) {
        console.warn('[provider] getAvailableRequests:', error?.message || error);
      }
      return [];
    }
  },

  acceptRequest: async (requestId: number): Promise<{
    requestId: number;
    status: string;
    provider: { id: number; name: string; phoneNumber: string };
    user: { id: number; firstName: string; lastName: string; phoneNumber: string; email: string };
    message: string;
  }> => {
    try {
      const response = await apiClient.post<any>(`/api/provider/requests/${requestId}/accept`);
      return (response as any).data;
    } catch (error: any) {
      if (isDuplicateActionError(error, ['accept', 'already accepted'])) {
        return {
          requestId,
          status: 'accepted',
          provider: { id: 0, name: '', phoneNumber: '' },
          user: { id: 0, firstName: '', lastName: '', phoneNumber: '', email: '' },
          message: 'Request was already accepted.',
        };
      }
      throw error;
    }
  },

  getAcceptedRequests: async (): Promise<ServiceRequest[]> => {
    try {
      const response = await apiClient.get<any>('/api/provider/requests/accepted');
      return normalizeProviderRequestList(response);
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      if (__DEV__) {
        console.warn('[provider] getAcceptedRequests:', error?.message || error);
      }
      return [];
    }
  },

  /** Single accepted job (for receipts) when client GET /request-service/requests/:id fails for provider token. */
  getAcceptedRequestById: async (requestId: number): Promise<ServiceRequest | null> => {
    try {
      const all = await providerService.getAcceptedRequests();
      const id = Number(requestId);
      const match = (all || []).find((r: any) => Number(r?.id) === id);
      return match ?? null;
    } catch {
      return null;
    }
  },

  /** Single provider request details from provider-scoped endpoint. */
  getRequestById: async (requestId: number): Promise<ServiceRequest | null> => {
    try {
      const response = await apiClient.get<any>(`/api/provider/requests/${requestId}`);
      const data = extractResponseData<any>(response);
      const normalized = (data as any)?.data ?? data;
      return normalized ? normalizeProviderRequestRecord(normalized as ServiceRequest) : null;
    } catch (error: any) {
      if (error instanceof AuthError) throw error;
      return null;
    }
  },

  /**
   * This provider's quotation row for a request (line items + totals) when other quotation endpoints fail.
   */
  getQuotationListItemForRequest: async (requestId: number): Promise<ProviderQuotationListItem | null> => {
    try {
      const response = await apiClient.get<any>('/api/provider/quotations');
      let list: any[] = [];
      const raw = extractResponseData<any>(response);
      if (Array.isArray(raw)) list = raw;
      else if (Array.isArray(raw?.quotations)) list = raw.quotations;
      else if (Array.isArray(raw?.data)) list = raw.data;
      else if (Array.isArray((response as any)?.data?.data)) list = (response as any).data.data;
      const id = Number(requestId);
      const item = list.find(
        (q: any) => Number(q?.requestId) === id || Number(q?.request?.id) === id
      );
      return item ?? null;
    } catch {
      return null;
    }
  },

  rejectRequest: async (requestId: number): Promise<{ requestId: number; acceptanceId: number; status: string; message: string }> => {
    try {
      const response = await apiClient.post<any>(`/api/provider/requests/${requestId}/reject`);
      return (response as any).data;
    } catch (error: any) {
      if ((error?.message || '').toLowerCase().includes('already rejected')) {
        return { requestId, acceptanceId: 0, status: 'rejected', message: 'Request was already declined.' } as any;
      }
      throw error;
    }
  },

  startWorkOrder: async (requestId: number): Promise<{ requestId: number; status: string; message?: string }> => {
    const response = await apiClient.post<any>(`/api/provider/requests/${requestId}/start`, {});
    const data = (response as any)?.data?.data ?? (response as any)?.data ?? (response as any)?.data;
    return {
      requestId,
      status: data?.status ?? 'in_progress',
      message: data?.message ?? 'Job started successfully.',
    };
  },

  markWorkComplete: async (requestId: number): Promise<{ requestId: number; status: string; message?: string }> => {
    const response = await apiClient.post<any>(`/api/provider/requests/${requestId}/complete`, {});
    const data = (response as any)?.data?.data ?? (response as any)?.data ?? (response as any)?.data;
    return {
      requestId,
      status: data?.status ?? 'reviewing',
      message: data?.message ?? 'Work marked complete. Waiting for client to confirm.',
    };
  },

  requestVisit: async (
    requestId: number,
    payload: { scheduledDate: string; scheduledTime: string; logisticsCost: number }
  ): Promise<{ requestId: number; scheduledDate: string; scheduledTime: string; logisticsCost: number; logisticsStatus: string; message: string }> => {
    await saveCachedVisitRequest(requestId, {
      ...payload,
      logisticsStatus: 'pending_payment',
    });
    const response = await apiClient.post<any>(`/api/provider/requests/${requestId}/request-visit`, payload);
    const data = (response as any)?.data?.data ?? (response as any)?.data;
    await saveCachedVisitRequest(requestId, {
      ...payload,
      ...(data || {}),
    });
    return data;
  },

  sendQuotation: async (requestId: number, payload: SendQuotationPayload): Promise<SendQuotationResponse> => {
    const response = await apiClient.post<any>(`/api/request-service/requests/${requestId}/quotation`, payload);
    return (response as any).data;
  },

  getQuotation: async (requestId: number): Promise<Quotation> => {
    const response = await apiClient.get<any>(`/api/request-service/requests/${requestId}/quotation`);
    const rawData = (response as any)?.data?.data || (response as any)?.data || response;
    const parseNumber = (v: any): number => {
      if (v == null) return 0;
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      if (typeof v === 'string') {
        const p = parseFloat(v.replace(/,/g, '').trim());
        return isNaN(p) ? 0 : p;
      }
      return 0;
    };
    return {
      ...rawData,
      id: rawData.id || 0,
      requestId: rawData.requestId || requestId,
      laborCost: parseNumber(rawData.laborCost),
      logisticsCost: parseNumber(rawData.logisticsCost),
      serviceCharge: parseNumber(rawData.serviceCharge),
      tax: parseNumber(rawData.tax),
      total: parseNumber(rawData.total),
      findingsAndWorkRequired: rawData.findingsAndWorkRequired || '',
      status: rawData.status || 'pending',
      sentAt: rawData.sentAt || new Date().toISOString(),
      acceptedAt: rawData.acceptedAt || null,
      rejectedAt: rawData.rejectedAt || null,
      message: rawData.message,
      materials: (rawData.materials || []).map((m: any) => ({
        name: m.name || '',
        quantity: parseNumber(m.quantity),
        unitPrice: parseNumber(m.unitPrice),
        total: parseNumber(m.total) || parseNumber(m.unitPrice) * parseNumber(m.quantity),
      })),
    };
  },

  getProviderQuotations: async (): Promise<ProviderQuotationListItem[]> => {
    const response = await apiClient.get<any>('/api/provider/quotations');
    return extractResponseData<ProviderQuotationListItem[]>(response) || [];
  },

  getProviderReviews: async (
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ reviews: any[]; total: number; limit: number; offset: number }> => {
    const { limit = 10, offset = 0 } = options;
    const response = await apiClient.get<any>(
      `/api/provider/reviews?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
    );
    const raw = extractResponseData<any>(response);
    const nested = raw?.data?.data ?? raw?.data ?? raw;
    const reviews = Array.isArray(nested?.reviews) ? nested.reviews : [];
    return {
      reviews,
      total: Number(nested?.total ?? reviews.length) || 0,
      limit: Number(nested?.limit ?? limit) || limit,
      offset: Number(nested?.offset ?? offset) || offset,
    };
  },

  getProviderAnalytics: async (): Promise<{
    earningsOverview: {
      thisWeek: number;
      thisMonth: number;
      percentChangeWeek: number;
      percentChangeMonth: number;
    };
    availableBalance: number;
    jobsCompletedThisWeek: number;
    quotationApproval: {
      approvalRate: number;
      accepted: number;
      rejected: number;
    };
    ratings: {
      providerId: number;
      averageRating: number;
      totalReviews: number;
    };
    latestReviews: any[];
  }> => {
    const response = await apiClient.get<any>('/api/provider/analytics');
    const raw = extractResponseData<any>(response);
    const nested = raw?.data?.data ?? raw?.data ?? raw ?? {};
    return {
      earningsOverview: {
        thisWeek: Number(nested?.earningsOverview?.thisWeek ?? 0) || 0,
        thisMonth: Number(nested?.earningsOverview?.thisMonth ?? 0) || 0,
        percentChangeWeek: Number(nested?.earningsOverview?.percentChangeWeek ?? 0) || 0,
        percentChangeMonth: Number(nested?.earningsOverview?.percentChangeMonth ?? 0) || 0,
      },
      availableBalance: Number(nested?.availableBalance ?? 0) || 0,
      jobsCompletedThisWeek: Number(nested?.jobsCompletedThisWeek ?? 0) || 0,
      quotationApproval: {
        approvalRate: Number(nested?.quotationApproval?.approvalRate ?? 0) || 0,
        accepted: Number(nested?.quotationApproval?.accepted ?? 0) || 0,
        rejected: Number(nested?.quotationApproval?.rejected ?? 0) || 0,
      },
      ratings: {
        providerId: Number(nested?.ratings?.providerId ?? 0) || 0,
        averageRating: Number(nested?.ratings?.averageRating ?? 0) || 0,
        totalReviews: Number(nested?.ratings?.totalReviews ?? 0) || 0,
      },
      latestReviews: Array.isArray(nested?.latestReviews) ? nested.latestReviews : [],
    };
  },
};

export { providerService };
