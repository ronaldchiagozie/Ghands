import { formatNaira, parseMoney, quotationTotal, resolveJobTotal } from '@/utils/jobTotal';

describe('what a finished job cost', () => {
  it('reads money however it arrives', () => {
    expect(parseMoney(40)).toBe(40);
    expect(parseMoney('40')).toBe(40);
    expect(parseMoney('₦40.00')).toBe(40);
    expect(parseMoney('1,250.50')).toBe(1250.5);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney('not a number')).toBe(0);
    expect(parseMoney(Number.NaN)).toBe(0);
  });

  it('takes the quotation total when it states one', () => {
    expect(quotationTotal({ total: 40 })).toBe(40);
    expect(quotationTotal({ total: '₦40.00' })).toBe(40);
  });

  /** Older quotations carry the lines but no total; the receipt adds them up. */
  it('adds the lines up when it does not', () => {
    expect(
      quotationTotal({
        laborCost: 10000,
        logisticsCost: 2000,
        materials: [
          { unitPrice: 500, quantity: 3 },
          { unitPrice: 250, quantity: 2 },
        ],
      }),
    ).toBe(14000);
  });

  it('is zero for a quotation that is not there', () => {
    expect(quotationTotal(null)).toBe(0);
    expect(quotationTotal(undefined)).toBe(0);
    expect(quotationTotal({})).toBe(0);
  });

  /**
   * The bug this file exists for: the request record carried no total on a
   * job whose receipt read ₦40.00, because the figure lives on the
   * quotation. The two must never disagree.
   */
  it('prefers the quotation, which is where the receipt looks', () => {
    expect(resolveJobTotal({ total: 40 }, { totalCost: 999 })).toBe(40);
  });

  it('falls back to whichever key the record happens to use', () => {
    expect(resolveJobTotal(null, { totalCost: 40 })).toBe(40);
    expect(resolveJobTotal(null, { total_amount: '40' })).toBe(40);
    expect(resolveJobTotal(null, { paymentAmount: 40 })).toBe(40);
    expect(resolveJobTotal(null, { amountDueOnArrival: 40 })).toBe(40);
  });

  /** Null, not zero. A zero is a statement about what somebody paid. */
  it('says nothing rather than says free', () => {
    expect(resolveJobTotal(null, {})).toBeNull();
    expect(resolveJobTotal({ total: 0 }, { totalCost: 0 })).toBeNull();
    expect(resolveJobTotal(null, null)).toBeNull();
  });

  it('formats the way the receipt does', () => {
    expect(formatNaira(40)).toBe('₦40.00');
    expect(formatNaira(1250.5)).toBe('₦1,250.50');
  });
});
