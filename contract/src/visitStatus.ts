export type VisitDeclineActor = 'client' | 'provider' | 'unknown';

const VISIT_DECLINED_STATUSES = new Set([
  'cancelled',
  'declined',
  'rejected',
  'provider_cancelled',
  'provider_declined',
  'provider_rejected',
  'client_cancelled',
  'client_declined',
  'client_rejected',
  'visit_cancelled',
  'visit_declined',
]);

export function getVisitLogisticsStatus(visitRequest?: Record<string, unknown> | null): string {
  if (!visitRequest) return '';
  const status =
    visitRequest.logisticsStatus ??
    visitRequest.logistics_status ??
    visitRequest.visitStatus ??
    visitRequest.visit_status;
  return typeof status === 'string' ? status.toLowerCase().trim() : '';
}

export function isVisitDeclined(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest) return false;
  const status = getVisitLogisticsStatus(visitRequest);
  if (VISIT_DECLINED_STATUSES.has(status)) return true;
  if (status.includes('cancel') || status.includes('declin') || status.includes('reject')) return true;
  if (visitRequest.declined === true || visitRequest.cancelled === true) return true;
  return false;
}

export function getVisitDeclineActor(visitRequest?: Record<string, unknown> | null): VisitDeclineActor {
  if (!isVisitDeclined(visitRequest)) return 'unknown';

  const actorRaw = [
    visitRequest?.declinedBy,
    visitRequest?.declined_by,
    visitRequest?.cancelledBy,
    visitRequest?.cancelled_by,
    visitRequest?.declinedByRole,
    visitRequest?.declined_by_role,
  ]
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  const actor = typeof actorRaw === 'string' ? actorRaw.toLowerCase() : '';
  if (actor.includes('provider')) return 'provider';
  if (actor.includes('client') || actor.includes('user') || actor.includes('customer')) return 'client';

  const status = getVisitLogisticsStatus(visitRequest);
  if (status.includes('provider')) return 'provider';
  if (status.includes('client') || status.includes('user')) return 'client';

  return 'unknown';
}

export function getVisitDeclinedDescription(
  visitRequest?: Record<string, unknown> | null,
  audience: 'client' | 'provider' = 'provider'
): string {
  const actor = getVisitDeclineActor(visitRequest);
  if (audience === 'provider') {
    if (actor === 'provider') return 'You declined the visit.';
    if (actor === 'client') return 'Client declined the visit.';
    return 'Visit was declined.';
  }
  if (actor === 'client') return 'You declined the visit.';
  if (actor === 'provider') return 'Provider declined the visit.';
  return 'Visit was declined.';
}

export function patchVisitDeclined(
  visitRequest?: Record<string, unknown> | null,
  actor: VisitDeclineActor = 'client'
): Record<string, unknown> {
  const status =
    actor === 'client'
      ? 'client_declined'
      : actor === 'provider'
        ? 'provider_declined'
        : 'declined';
  return {
    ...(visitRequest || {}),
    logisticsStatus: status,
    declined: true,
    ...(actor !== 'unknown' ? { declinedBy: actor } : {}),
  };
}

/** Some backends mark the whole request cancelled when only the visit was declined. */
export function healJobStatusAfterVisitDecline<T extends { status?: string; visitRequest?: unknown }>(
  request: T
): T {
  if (!isVisitDeclined(request.visitRequest as Record<string, unknown> | null | undefined)) {
    return request;
  }
  const status = (request.status || '').toString().toLowerCase();
  if (status === 'cancelled' || status === 'inspecting' || status === 'accepted') {
    return { ...request, status: 'quoting' as T['status'] };
  }
  return request;
}

/**
 * Statuses that mean the visit fee has been settled.
 *
 * Must stay identical to `VISIT_PAID_STATUSES` in the provider app's
 * utils/visitStatus.ts. The provider already accepted these four; the client
 * accepted only `paid`, so a backend answer of `confirmed` / `completed` /
 * `success` read as settled on the provider side and unpaid on the client side —
 * which left the client still offering "Pay visit fee" for a fee already taken.
 */
const VISIT_PAID_STATUSES = new Set(['paid', 'confirmed', 'completed', 'success']);

/** True when `status` (already normalized) means the visit fee is settled. */
function isPaidVisitStatus(status?: string | null): boolean {
  return !!status && VISIT_PAID_STATUSES.has(status);
}

export function isTerminalVisitStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return isPaidVisitStatus(normalized) || isVisitDeclined({ logisticsStatus: normalized });
}

export function hasVisitRequestEvidence(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest) return false;
  return !!(
    visitRequest.scheduledDate ||
    visitRequest.scheduled_date ||
    visitRequest.scheduledTime ||
    visitRequest.scheduled_time ||
    visitRequest.requestedAt ||
    visitRequest.requested_at ||
    visitRequest.logisticsStatus ||
    visitRequest.logistics_status ||
    visitRequest.logisticsCost != null ||
    visitRequest.logistics_cost != null
  );
}

const VISIT_BYPASS_STATUSES = [
  'skipped',
  'bypassed',
  'not_required',
  'notrequired',
  'waived',
  'direct_quote',
  'direct_quotation',
  'no_visit',
];

/** Backend may attach a placeholder visit record when the provider chose a direct quote. */
export function isVisitBypassed(visitRequest?: Record<string, unknown> | null): boolean {
  const status = getVisitLogisticsStatus(visitRequest);
  if (!status) return false;
  return VISIT_BYPASS_STATUSES.some((token) => status.includes(token));
}

function parseVisitMoney(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[₦,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** True when a real inspection/visit was requested or completed — not a direct-quote placeholder. */
export function hasMeaningfulVisitEngagement(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest || isVisitBypassed(visitRequest)) return false;
  if (isVisitDeclined(visitRequest)) return false;
  if (isVisitPaid(visitRequest) || isVisitCompletedOrPaid(visitRequest)) return true;

  const hasSchedule = !!(
    visitRequest.scheduledDate ||
    visitRequest.scheduled_date ||
    visitRequest.scheduledTime ||
    visitRequest.scheduled_time
  );
  const hasRequestedAt = !!(visitRequest.requestedAt || visitRequest.requested_at);
  const visitCost =
    parseVisitMoney(visitRequest.logisticsCost) ??
    parseVisitMoney(visitRequest.logistics_cost) ??
    parseVisitMoney(visitRequest.logisticsFee) ??
    parseVisitMoney(visitRequest.logistics_fee);
  const hasFee = typeof visitCost === 'number' && visitCost > 0;

  if (hasSchedule || hasRequestedAt || hasFee) return true;

  const status = getVisitLogisticsStatus(visitRequest);
  if (!status) return false;

  if (['pending', 'pending_payment', 'awaiting_payment', 'requested'].includes(status)) {
    return hasSchedule || hasRequestedAt || hasFee;
  }

  return true;
}

export function isVisitPaid(visitRequest?: Record<string, unknown> | null): boolean {
  return isPaidVisitStatus(getVisitLogisticsStatus(visitRequest));
}

const PROVIDER_VISIT_REQUEST_STATUSES = [
  'pending',
  'pending_payment',
  'awaiting_payment',
  'payment_pending',
  'requested',
  'visit_requested',
  'awaiting_client',
  'awaiting_confirmation',
  'sent',
];

function parseVisitMoneyForGate(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[₦,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Provider sent a visit request the client can respond to (pay or decline). */
export function isProviderVisitRequestSent(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest || isVisitDeclined(visitRequest)) return false;
  if (isVisitPaid(visitRequest) || isVisitCompletedOrPaid(visitRequest)) return false;

  const hasRequestedAt = !!(visitRequest.requestedAt || visitRequest.requested_at);
  const visitCost =
    parseVisitMoneyForGate(visitRequest.logisticsCost) ??
    parseVisitMoneyForGate(visitRequest.logistics_cost) ??
    parseVisitMoneyForGate(visitRequest.logisticsFee) ??
    parseVisitMoneyForGate(visitRequest.logistics_fee);
  const hasFee = typeof visitCost === 'number' && visitCost > 0;

  const status = getVisitLogisticsStatus(visitRequest);
  if (isPaidVisitStatus(status)) return false;
  if (status && (status.includes('declin') || status.includes('cancel') || status.includes('reject'))) {
    return false;
  }

  if (hasRequestedAt) return true;
  if (hasFee) return true;

  if (
    status &&
    PROVIDER_VISIT_REQUEST_STATUSES.some((token) => status === token || status.includes(token))
  ) {
    return true;
  }

  // Client job date/time alone is not a provider visit request — backend decline-visit will 400.
  return false;
}

/** Client may pay visit fee under the same conditions as decline (provider-initiated visit, unpaid). */
export function canClientPayVisitFee(input: Parameters<typeof canClientDeclineVisit>[0]): boolean {
  return canClientDeclineVisit(input);
}

/**
 * Client may decline a visit only after a provider sent one and before the visit fee is paid.
 */
export function canClientDeclineVisit(input: {
  visitRequest?: Record<string, unknown> | null;
  providerHasAccepted: boolean;
  visitDeclined: boolean;
  hasQuotationSent: boolean;
}): boolean {
  const { visitRequest, providerHasAccepted, visitDeclined, hasQuotationSent } = input;
  if (!providerHasAccepted || visitDeclined || hasQuotationSent) return false;
  return isProviderVisitRequestSent(visitRequest);
}

export function isVisitCompletedOrPaid(visitRequest?: Record<string, unknown> | null): boolean {
  const status = getVisitLogisticsStatus(visitRequest);
  if (!status) return isVisitPaid(visitRequest);
  if (isPaidVisitStatus(status)) return true;
  return ['completed', 'complete', 'done', 'visited', 'inspected', 'confirmed', 'finished'].some(
    (token) => status.includes(token)
  );
}

export function quotationImpliesPriorVisit(quotations: unknown[] | null | undefined): boolean {
  if (!Array.isArray(quotations)) return false;
  return quotations.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const quote = entry as Record<string, unknown>;

    const visitedAt =
      quote.visitCompletedAt ??
      quote.visit_completed_at ??
      quote.inspectedAt ??
      quote.inspected_at ??
      quote.visitDate ??
      quote.visit_date;
    if (typeof visitedAt === 'string' && visitedAt.trim().length > 0) return true;

    if (quote.visitCompleted === true || quote.visit_completed === true) return true;
    if (quote.inspectionCompleted === true || quote.inspection_completed === true) return true;

    return false;
  });
}

/** True when a site visit was requested, paid, completed, or clearly happened before a quote. */
export function resolveVisitOccurred(input: {
  visitRequest?: Record<string, unknown> | null;
  requestStatus?: string | null;
  quotations?: unknown[] | null;
}): boolean {
  const { visitRequest, requestStatus, quotations } = input;
  if (isVisitDeclined(visitRequest)) return false;
  if (hasMeaningfulVisitEngagement(visitRequest)) return true;
  if (isProviderVisitRequestSent(visitRequest)) return true;
  if (quotationImpliesPriorVisit(quotations)) return true;
  const status = (requestStatus || '').toLowerCase();
  if (status === 'inspecting' && !isVisitDeclined(visitRequest)) return true;
  return false;
}
