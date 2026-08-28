import { isAbandonedDraft, isSubmittedBooking } from '@ghands/contract';

const detailed = { jobTitle: 'Air conditioning', description: 'AC not cooling', status: 'pending' };

describe('isSubmittedBooking', () => {
  /**
   * The bug this exists for: the service request row is created the moment a
   * category is tapped. A user who filled in the details and then quit before
   * choosing a provider still had a row, and the jobs list showed it as
   * "Pending" — as though providers were being found for a booking that was
   * never actually made.
   */
  it('rejects a request created by tapping a category and nothing else', () => {
    expect(isSubmittedBooking({ status: 'pending' })).toBe(false);
  });

  it('rejects details filled in but no provider ever chosen', () => {
    expect(isSubmittedBooking(detailed)).toBe(false);
    expect(isAbandonedDraft(detailed)).toBe(true);
  });

  it('accepts once a provider has been selected', () => {
    expect(isSubmittedBooking({ ...detailed, selectedProvider: { id: 7 } })).toBe(true);
  });

  it('accepts once providers have accepted', () => {
    expect(isSubmittedBooking(detailed, { acceptedProviderCount: 2 })).toBe(true);
  });

  it('accepts once quotations exist', () => {
    expect(isSubmittedBooking(detailed, { quotationCount: 1 })).toBe(true);
  });

  it('accepts once a schedule is set', () => {
    expect(isSubmittedBooking({ ...detailed, scheduledDate: '2026-09-01' })).toBe(true);
    expect(isSubmittedBooking({ ...detailed, scheduledTime: '10:00' })).toBe(true);
  });

  it.each(['accepted', 'inspecting', 'quoting', 'scheduled', 'in_progress', 'reviewing', 'completed'])(
    'accepts a live job in status "%s" whatever else is missing',
    (status) => {
      expect(isSubmittedBooking({ ...detailed, status })).toBe(true);
    },
  );

  it('still requires the details the flow collects', () => {
    expect(isSubmittedBooking({ description: 'no title', selectedProvider: { id: 7 } })).toBe(false);
    expect(isSubmittedBooking({ jobTitle: 'no description', selectedProvider: { id: 7 } })).toBe(false);
    expect(isSubmittedBooking({ jobTitle: '   ', description: '   ', selectedProvider: { id: 7 } })).toBe(false);
  });

  it('handles a missing request without throwing', () => {
    expect(isSubmittedBooking(null)).toBe(false);
    expect(isSubmittedBooking(undefined)).toBe(false);
  });
});
