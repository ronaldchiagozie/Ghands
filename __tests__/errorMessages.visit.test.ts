import { describe, expect, it } from '@jest/globals';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

describe('getSpecificErrorMessage — client visit actions', () => {
  it('maps backend “no visit requested” to a clear client message on decline', () => {
    const msg = getSpecificErrorMessage(
      {
        message: 'No visit has been requested for this service request',
        status: 400,
      },
      'decline_visit',
    );
    expect(msg).toContain('provider has not requested');
  });

  it('maps similar logistics / visit errors on pay_logistics_fee', () => {
    const msg = getSpecificErrorMessage(
      {
        message: 'No visit has been requested for this service request',
        status: 400,
      },
      'pay_logistics_fee',
    );
    expect(msg).toContain('provider has not requested');
  });
});
