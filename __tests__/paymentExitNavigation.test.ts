import { exitPaymentToJob, navigateToJob } from '@/utils/navigation';

function makeRouter(withDismissTo: boolean) {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    ...(withDismissTo ? { dismissTo: jest.fn() } : {}),
  };
}

const jobRoute = expect.objectContaining({
  pathname: '/OngoingJobDetails',
  params: expect.objectContaining({ requestId: '42', tab: 'updates' }),
});

describe('exitPaymentToJob', () => {
  /**
   * The payment screens are pushed on top of OngoingJobDetails, so `replace`
   * swapped the receipt for a *second* copy of the job screen and left the
   * pre-payment one underneath for back to land on.
   */
  it('pops back to the job screen already in the stack', () => {
    const router = makeRouter(true);

    exitPaymentToJob(router as any, 42);

    expect(router.dismissTo).toHaveBeenCalledWith(jobRoute);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('carries the updates tab so the job reopens on the payment timeline', () => {
    const router = makeRouter(true);

    exitPaymentToJob(router as any, '7');

    expect(router.dismissTo).toHaveBeenCalledWith(
      expect.objectContaining({ params: { requestId: '7', tab: 'updates' } }),
    );
  });

  it('falls back to replace when the router cannot pop', () => {
    const router = makeRouter(false);

    exitPaymentToJob(router as any, 42);

    expect(router.replace).toHaveBeenCalledWith(jobRoute);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('navigateToJob', () => {
  it('pushes onto the stack by default', () => {
    const router = makeRouter(true);

    navigateToJob(router as any, { requestId: 42 });

    expect(router.push).toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('still replaces when asked to replace', () => {
    const router = makeRouter(true);

    navigateToJob(router as any, { requestId: 42, replace: true });

    expect(router.replace).toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('passes booking and payment flags through to the job screen', () => {
    const router = makeRouter(true);

    navigateToJob(router as any, {
      requestId: 42,
      tab: 'quotations',
      fromBooking: true,
      paymentStatus: 'success',
    });

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          requestId: '42',
          tab: 'quotations',
          fromBooking: '1',
          paymentStatus: 'success',
        },
      }),
    );
  });
});
