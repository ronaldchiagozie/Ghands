import { describe, expect, it } from '@jest/globals';
import { resolveJobDisplayStatus } from '@/utils/jobDisplayStatus';

const CLIENT_JOB_SCHEDULE_ONLY = {
  scheduledDate: '2026-06-01T00:00:00.000Z',
  scheduledTime: '3:00 PM',
};

describe('resolveJobDisplayStatus / visit UI alignment', () => {
  it('does not show Inspecting for client schedule-only visitRequest', () => {
    const status = resolveJobDisplayStatus('accepted', {
      acceptedProvidersCount: 1,
      hasQuotationSent: false,
      visitRequest: {
        scheduledDate: '2026-06-01T00:00:00.000Z',
        scheduledTime: '3:00 PM',
      },
    });
    expect(status).toBe('Accepted');
  });

  it('shows Inspecting when provider sent a visit request', () => {
    const status = resolveJobDisplayStatus('accepted', {
      acceptedProvidersCount: 1,
      hasQuotationSent: false,
      visitRequest: {
        requestedAt: '2026-06-01T10:00:00.000Z',
        logisticsCost: 5000,
        logisticsStatus: 'pending_payment',
      },
    });
    expect(status).toBe('Inspecting');
  });

  it('returns Quoting when quote exists regardless of visit schedule noise', () => {
    const status = resolveJobDisplayStatus('accepted', {
      acceptedProvidersCount: 1,
      hasQuotationSent: true,
      visitRequest: CLIENT_JOB_SCHEDULE_ONLY,
    });
    expect(status).toBe('Quoting');
  });

  it('shows Quoting when visit was declined (next step is quotation)', () => {
    const status = resolveJobDisplayStatus('inspecting', {
      acceptedProvidersCount: 1,
      hasQuotationSent: false,
      visitRequest: {
        scheduledDate: '2026-06-01T00:00:00.000Z',
        logisticsStatus: 'client_declined',
        declined: true,
        declinedBy: 'client',
      },
    });
    expect(status).toBe('Quoting');
  });
});
