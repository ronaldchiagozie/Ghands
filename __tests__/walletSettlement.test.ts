import {
  canPollForSettlement,
  findSettlementRow,
  matchesSettlementReference,
} from '@/utils/walletSettlement';

describe('matchesSettlementReference', () => {
  it('matches a row carrying the same reference', () => {
    expect(matchesSettlementReference({ reference: 'REF-1' }, 'REF-1')).toBe(true);
  });

  it('ignores surrounding whitespace on either side', () => {
    expect(matchesSettlementReference({ reference: ' REF-1 ' }, 'REF-1')).toBe(true);
  });

  it('does not match a different reference', () => {
    expect(matchesSettlementReference({ reference: 'REF-2' }, 'REF-1')).toBe(false);
  });

  /**
   * The regression this util exists for: `String(undefined ?? '')` is `''` on
   * both sides, so a naive `===` read an unrelated referenceless row as the
   * verdict for a payment that also came back without a reference.
   */
  it('never matches when the payment has no reference', () => {
    expect(matchesSettlementReference({ reference: undefined }, undefined)).toBe(false);
    expect(matchesSettlementReference({ reference: undefined }, '')).toBe(false);
    expect(matchesSettlementReference({ reference: 'REF-1' }, '')).toBe(false);
  });

  it('never matches when the row has no reference', () => {
    expect(matchesSettlementReference({ reference: undefined }, 'REF-1')).toBe(false);
    expect(matchesSettlementReference({ reference: '   ' }, 'REF-1')).toBe(false);
    expect(matchesSettlementReference({}, 'REF-1')).toBe(false);
  });
});

describe('findSettlementRow', () => {
  const rows = [
    { reference: undefined, status: 'completed' },
    { reference: 'REF-OTHER', status: 'failed' },
    { reference: 'REF-1', status: 'pending' },
  ];

  it('returns the row raised by the reference', () => {
    expect(findSettlementRow(rows, 'REF-1')).toEqual({ reference: 'REF-1', status: 'pending' });
  });

  it('returns undefined when the row has not landed yet', () => {
    expect(findSettlementRow(rows, 'REF-MISSING')).toBeUndefined();
  });

  /** Would otherwise return the leading referenceless row and report `completed`. */
  it('returns undefined for a blank reference instead of the first referenceless row', () => {
    expect(findSettlementRow(rows, '')).toBeUndefined();
    expect(findSettlementRow(rows, undefined)).toBeUndefined();
  });
});

describe('canPollForSettlement', () => {
  it('is true only for a usable reference', () => {
    expect(canPollForSettlement('REF-1')).toBe(true);
    expect(canPollForSettlement('')).toBe(false);
    expect(canPollForSettlement('   ')).toBe(false);
    expect(canPollForSettlement(null)).toBe(false);
    expect(canPollForSettlement(undefined)).toBe(false);
  });
});
