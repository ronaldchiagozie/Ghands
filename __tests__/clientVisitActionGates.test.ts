/**
 * Demo checklist: UI actions must match backend preconditions.
 * Run: npm test -- visitStatus jobDisplayStatus errorMessages.visit
 *
 * Key rule: client job date/time ≠ provider visit request.
 * Pay / decline visit require provider evidence (requestedAt, fee, or pending visit status).
 */
import { describe, expect, it } from '@jest/globals';
import {
  canClientDeclineVisit,
  canClientPayVisitFee,
  isProviderVisitRequestSent,
} from '@/utils/visitStatus';

const CLIENT_SCHEDULE = {
  scheduledDate: '2026-06-01T00:00:00.000Z',
  scheduledTime: '3:00 PM',
};

const PROVIDER_VISIT = {
  requestedAt: '2026-06-01T12:00:00.000Z',
  logisticsCost: 4000,
  logisticsStatus: 'pending_payment',
};

describe('client visit action gates (pay + decline stay in sync)', () => {
  const input = {
    providerHasAccepted: true,
    visitDeclined: false,
    hasQuotationSent: false,
  };

  it('neither pay nor decline for schedule-only payload', () => {
    expect(isProviderVisitRequestSent(CLIENT_SCHEDULE)).toBe(false);
    expect(canClientDeclineVisit({ ...input, visitRequest: CLIENT_SCHEDULE })).toBe(false);
    expect(canClientPayVisitFee({ ...input, visitRequest: CLIENT_SCHEDULE })).toBe(false);
  });

  it('both pay and decline allowed for provider visit payload', () => {
    expect(isProviderVisitRequestSent(PROVIDER_VISIT)).toBe(true);
    expect(canClientDeclineVisit({ ...input, visitRequest: PROVIDER_VISIT })).toBe(true);
    expect(canClientPayVisitFee({ ...input, visitRequest: PROVIDER_VISIT })).toBe(true);
  });
});
