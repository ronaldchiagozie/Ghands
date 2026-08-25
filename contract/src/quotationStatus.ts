/** Shared rules for when a job has a sent/reviewable quotation. */
export function quotationListHasSentQuote(quotations: unknown[] | null | undefined): boolean {
  const list = Array.isArray(quotations) ? quotations : [];
  return list.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const q = entry as Record<string, unknown>;
    if (q.sentAt || q.submittedAt) return true;
    const status = q.status;
    if (typeof status === 'string' && status.trim() && status !== 'draft') return true;
    const total = q.total;
    if (total != null && Number(total) > 0) return true;
    return false;
  });
}

export function requestImpliesSentQuote(request?: Record<string, unknown> | null): boolean {
  if (!request) return false;
  return Boolean(request.providerId && request.price != null);
}

export function jobHasSentQuotation(
  quotations: unknown[] | null | undefined,
  request?: Record<string, unknown> | null,
): boolean {
  return quotationListHasSentQuote(quotations) || requestImpliesSentQuote(request);
}

export function countSentQuotations(quotations: unknown[] | null | undefined): number {
  const list = Array.isArray(quotations) ? quotations : [];
  return list.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const q = entry as Record<string, unknown>;
    if (q.sentAt || q.submittedAt) return true;
    const status = q.status;
    if (typeof status === 'string' && status.trim() && status !== 'draft') return true;
    const total = q.total;
    if (total != null && Number(total) > 0) return true;
    return false;
  }).length;
}
