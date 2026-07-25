import { describe, expect, it } from '@jest/globals';
import {
  getInspectionNegotiationStep,
  getQuotationNegotiationStep,
} from '@/utils/timelineNegotiationSteps';

describe('getInspectionNegotiationStep — declined visit', () => {
  it('marks inspection declined with correct copy for client', () => {
    const step = getInspectionNegotiationStep({
      audience: 'client',
      providerHasAccepted: true,
      quotationSent: false,
      hasVisitRequested: true,
      visitDeclined: true,
      visitPaid: false,
      visitScheduleText: 'Jun 1, 3:00 PM',
      visitRequest: {
        logisticsStatus: 'client_declined',
        declined: true,
        declinedBy: 'client',
      },
      visitOccurred: true,
    });
    expect(step.isDeclined).toBe(true);
    expect(step.isSkipped).toBe(false);
    expect(step.status).toBe('Declined');
    expect(step.description.toLowerCase()).toContain('declined');
    expect(step.isActive).toBe(false);
  });

  it('stays declined (not skipped) when a quote exists after client declined visit', () => {
    const step = getInspectionNegotiationStep({
      audience: 'client',
      providerHasAccepted: true,
      quotationSent: true,
      hasVisitRequested: true,
      visitDeclined: true,
      visitPaid: false,
      visitScheduleText: 'Jun 1, 3:00 PM',
      visitRequest: {
        logisticsStatus: 'client_declined',
        declined: true,
        declinedBy: 'client',
      },
    });
    expect(step.isDeclined).toBe(true);
    expect(step.isSkipped).toBe(false);
    expect(step.status).toBe('Declined');
  });

  it('shows skipped when provider chose direct quote without a visit', () => {
    const step = getInspectionNegotiationStep({
      audience: 'client',
      providerHasAccepted: true,
      quotationSent: true,
      hasVisitRequested: false,
      visitDeclined: false,
      visitPaid: false,
      visitScheduleText: '—',
      visitRequest: { logisticsStatus: 'direct_quote' },
      visitOccurred: false,
    });
    expect(step.isSkipped).toBe(true);
    expect(step.status).toBe('Skipped');
    expect(step.isDeclined).toBe(false);
  });
});

describe('getQuotationNegotiationStep — after visit decline', () => {
  it('activates quotation step for client while waiting on provider', () => {
    const step = getQuotationNegotiationStep({
      audience: 'client',
      providerHasAccepted: true,
      quotationSent: false,
      hasVisitRequested: true,
      visitDeclined: true,
      visitPaid: false,
      visitBlocksQuote: false,
      visitOccurred: false,
    });
    expect(step.isActive).toBe(true);
    expect(step.isCompleted).toBe(false);
  });
});
