import { describe, expect, it } from '@jest/globals';
import {
  canClientDeclineVisit,
  canClientPayVisitFee,
  isProviderVisitRequestSent,
  isTerminalVisitStatus,
  isVisitDeclined,
  isVisitPaid,
  patchVisitDeclined,
  resolveVisitOccurred,
} from '@/utils/visitStatus';

/** Client booking date/time only (no provider visit request) — reproduces request #55-style payloads. */
const CLIENT_JOB_SCHEDULE_ONLY = {
  scheduledDate: '2026-06-01T00:00:00.000Z',
  scheduledTime: '3:00 PM',
};

const PROVIDER_VISIT_WITH_FEE = {
  scheduledDate: '2026-06-01T00:00:00.000Z',
  scheduledTime: '3:00 PM',
  logisticsCost: 5000,
  requestedAt: '2026-06-01T10:00:00.000Z',
  logisticsStatus: 'pending_payment',
};

const PROVIDER_VISIT_REQUESTED_AT_ONLY = {
  requestedAt: '2026-06-01T10:00:00.000Z',
};

describe('isProviderVisitRequestSent', () => {
  it('returns false for client job schedule only (backend: no visit requested)', () => {
    expect(isProviderVisitRequestSent(CLIENT_JOB_SCHEDULE_ONLY)).toBe(false);
  });

  it('returns true when provider set requestedAt', () => {
    expect(isProviderVisitRequestSent(PROVIDER_VISIT_REQUESTED_AT_ONLY)).toBe(true);
  });

  it('returns true when provider set a visit fee', () => {
    expect(
      isProviderVisitRequestSent({
        logisticsCost: 3500,
        logisticsStatus: 'pending',
      }),
    ).toBe(true);
  });

  it('returns true for pending visit workflow status', () => {
    expect(
      isProviderVisitRequestSent({
        logisticsStatus: 'awaiting_payment',
      }),
    ).toBe(true);
  });

  it('returns false after client declined', () => {
    expect(isProviderVisitRequestSent(patchVisitDeclined(PROVIDER_VISIT_WITH_FEE, 'client'))).toBe(
      false,
    );
  });
});

describe('canClientDeclineVisit', () => {
  const base = {
    providerHasAccepted: true,
    visitDeclined: false,
    hasQuotationSent: false,
  };

  it('does not allow decline for client schedule-only visitRequest', () => {
    expect(
      canClientDeclineVisit({
        ...base,
        visitRequest: CLIENT_JOB_SCHEDULE_ONLY,
      }),
    ).toBe(false);
  });

  it('allows decline when provider sent a visit request', () => {
    expect(
      canClientDeclineVisit({
        ...base,
        visitRequest: PROVIDER_VISIT_WITH_FEE,
      }),
    ).toBe(true);
  });

  it('blocks decline when quotation already sent', () => {
    expect(
      canClientDeclineVisit({
        ...base,
        visitRequest: PROVIDER_VISIT_WITH_FEE,
        hasQuotationSent: true,
      }),
    ).toBe(false);
  });

  it('blocks decline when provider has not accepted', () => {
    expect(
      canClientDeclineVisit({
        ...base,
        providerHasAccepted: false,
        visitRequest: PROVIDER_VISIT_WITH_FEE,
      }),
    ).toBe(false);
  });

  it('blocks decline when visit already declined', () => {
    expect(
      canClientDeclineVisit({
        ...base,
        visitRequest: patchVisitDeclined(PROVIDER_VISIT_WITH_FEE, 'client'),
        visitDeclined: true,
      }),
    ).toBe(false);
  });
});

describe('resolveVisitOccurred vs provider visit (UI copy gates)', () => {
  it('may be true for client schedule via meaningful engagement — do not use alone for pay/decline', () => {
    const occurred = resolveVisitOccurred({
      visitRequest: CLIENT_JOB_SCHEDULE_ONLY,
      requestStatus: 'accepted',
      quotations: [],
    });
    expect(occurred).toBe(true);
    expect(isProviderVisitRequestSent(CLIENT_JOB_SCHEDULE_ONLY)).toBe(false);
  });
});

describe('patchVisitDeclined', () => {
  it('marks visit so isVisitDeclined is true', () => {
    const patched = patchVisitDeclined(PROVIDER_VISIT_WITH_FEE, 'client');
    expect(isVisitDeclined(patched)).toBe(true);
    expect(patched.declinedBy).toBe('client');
  });
});

describe('visit fee paid vocabulary (client ↔ provider parity)', () => {
  /**
   * The provider app accepts paid | confirmed | completed | success. The client
   * accepted only `paid`, so a visit the provider considered settled still
   * offered "Pay visit fee" here — a second charge for the same fee.
   * These four must stay in lockstep with the provider's VISIT_PAID_STATUSES.
   */
  const PAID = ['paid', 'confirmed', 'completed', 'success'];

  const gate = (logisticsStatus: string) => ({
    visitRequest: {
      logisticsStatus,
      logisticsCost: 5000,
      requestedAt: new Date().toISOString(),
    },
    providerHasAccepted: true,
    visitDeclined: false,
    hasQuotationSent: false,
  });

  it.each(PAID)('treats logisticsStatus "%s" as settled', (status) => {
    expect(isVisitPaid({ logisticsStatus: status })).toBe(true);
  });

  it.each(PAID)('does not offer payment again when status is "%s"', (status) => {
    expect(canClientPayVisitFee(gate(status))).toBe(false);
  });

  it('still offers payment while the fee is genuinely outstanding', () => {
    expect(isVisitPaid({ logisticsStatus: 'pending_payment' })).toBe(false);
    expect(canClientPayVisitFee(gate('pending_payment'))).toBe(true);
  });

  it('treats every settled status as terminal', () => {
    PAID.forEach((status) => expect(isTerminalVisitStatus(status)).toBe(true));
    expect(isTerminalVisitStatus('pending_payment')).toBe(false);
  });
});
