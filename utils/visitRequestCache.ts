import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTerminalVisitStatus, patchVisitDeclined } from './visitStatus';

const VISIT_REQUEST_CACHE_KEY = '@ghands:visit_request_cache';

export type CachedVisitRequest = {
  requestId: number;
  scheduledDate?: string;
  scheduledTime?: string;
  logisticsCost?: number;
  logisticsStatus?: string;
  requestedAt?: string;
  declinedBy?: string;
  declined?: boolean;
};

const parseMoneyValue = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[₦,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readCache = async (): Promise<Record<string, CachedVisitRequest>> => {
  try {
    const raw = await AsyncStorage.getItem(VISIT_REQUEST_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveCachedVisitRequest = async (
  requestId: number,
  visitRequest: Partial<CachedVisitRequest> & Record<string, unknown>
) => {
  const logisticsCost = parseMoneyValue(
    visitRequest.logisticsCost ??
      visitRequest.logistics_cost ??
      visitRequest.logisticsFee ??
      visitRequest.logistics_fee ??
      visitRequest.visitFee ??
      visitRequest.visit_fee ??
      visitRequest.inspectionFee ??
      visitRequest.inspection_fee ??
      visitRequest.amount
  );

  const cache = await readCache();
  const existing = cache[String(requestId)] || {};
  cache[String(requestId)] = {
    ...existing,
    requestId,
    scheduledDate: ((visitRequest.scheduledDate ?? visitRequest.scheduled_date) as string | undefined) ?? existing.scheduledDate,
    scheduledTime: ((visitRequest.scheduledTime ?? visitRequest.scheduled_time) as string | undefined) ?? existing.scheduledTime,
    logisticsCost: logisticsCost ?? existing.logisticsCost,
    logisticsStatus:
      visitRequest.declined === true || visitRequest.cancelled === true
        ? ((visitRequest.logisticsStatus ?? visitRequest.logistics_status) as string | undefined) ??
          existing.logisticsStatus ??
          'client_declined'
        : ((visitRequest.logisticsStatus ?? visitRequest.logistics_status) as string | undefined) ??
          existing.logisticsStatus,
    requestedAt: ((visitRequest.requestedAt ?? visitRequest.requested_at) as string | undefined) ?? existing.requestedAt,
    declinedBy: ((visitRequest.declinedBy ?? visitRequest.declined_by) as string | undefined) ?? existing.declinedBy,
    declined:
      visitRequest.declined === true || visitRequest.cancelled === true
        ? true
        : existing.declined,
  };

  await AsyncStorage.setItem(VISIT_REQUEST_CACHE_KEY, JSON.stringify(cache));
};

export const getCachedVisitRequest = async (requestId: number): Promise<CachedVisitRequest | null> => {
  const cache = await readCache();
  return cache[String(requestId)] || null;
};

export const mergeCachedVisitRequest = async <T extends { visitRequest?: any }>(
  requestId: number,
  request: T
): Promise<T> => {
  const cachedVisit = await getCachedVisitRequest(requestId);
  if (!cachedVisit) {
    return request;
  }

  const currentVisit = request.visitRequest || {};

  if (cachedVisit.declined === true) {
    const actor =
      cachedVisit.declinedBy === 'provider'
        ? 'provider'
        : cachedVisit.declinedBy === 'client'
          ? 'client'
          : 'client';
    const patched = patchVisitDeclined(currentVisit, actor);
    return {
      ...request,
      visitRequest: {
        ...currentVisit,
        ...patched,
        scheduledDate: currentVisit.scheduledDate ?? cachedVisit.scheduledDate,
        scheduledTime: currentVisit.scheduledTime ?? cachedVisit.scheduledTime,
        logisticsCost: currentVisit.logisticsCost ?? cachedVisit.logisticsCost,
        logisticsStatus:
          patched.logisticsStatus ??
          cachedVisit.logisticsStatus ??
          currentVisit.logisticsStatus,
        declinedBy: cachedVisit.declinedBy ?? patched.declinedBy,
        declined: true,
      },
    };
  }

  const hasCurrentCost =
    typeof currentVisit.logisticsCost === 'number' &&
    Number.isFinite(currentVisit.logisticsCost) &&
    currentVisit.logisticsCost > 0;

  const mergedStatus =
    isTerminalVisitStatus(String(currentVisit.logisticsStatus ?? ''))
      ? currentVisit.logisticsStatus
      : isTerminalVisitStatus(String(cachedVisit.logisticsStatus ?? ''))
        ? cachedVisit.logisticsStatus
        : cachedVisit.logisticsStatus ?? currentVisit.logisticsStatus;

  const merged = {
    ...request,
    visitRequest: {
      ...currentVisit,
      scheduledDate: hasCurrentCost
        ? currentVisit.scheduledDate ?? cachedVisit.scheduledDate
        : cachedVisit.scheduledDate ?? currentVisit.scheduledDate,
      scheduledTime: hasCurrentCost
        ? currentVisit.scheduledTime ?? cachedVisit.scheduledTime
        : cachedVisit.scheduledTime ?? currentVisit.scheduledTime,
      logisticsCost: hasCurrentCost ? currentVisit.logisticsCost : cachedVisit.logisticsCost,
      logisticsStatus: mergedStatus,
      requestedAt: hasCurrentCost
        ? currentVisit.requestedAt ?? cachedVisit.requestedAt
        : cachedVisit.requestedAt ?? currentVisit.requestedAt,
      declinedBy: cachedVisit.declinedBy ?? currentVisit.declinedBy,
      // A declined cachedVisit returns earlier, so only currentVisit can set this.
      declined: (currentVisit as { declined?: boolean }).declined === true,
    },
  };

  return merged;
};
