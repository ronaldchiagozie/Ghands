import { navigateBookingStepBack, returnToServiceMap } from '@/utils/bookingFlowNavigation';

function fakeRouter(canGoBack = true) {
  return {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
  } as any;
}

describe('leaving an edit opened from the booking summary', () => {
  it('goes back to the map it came from instead of opening another', () => {
    const router = fakeRouter();
    navigateBookingStepBack(router, { bookingOrigin: 'serviceMap', requestId: '9' });
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns a saved edit to that same map, keeping the draft it belongs to', () => {
    const router = fakeRouter();
    returnToServiceMap(router, { requestId: '9', selectedDate: '2026-10-01', location: undefined });
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/ServiceMapScreen',
      params: { requestId: '9', selectedDate: '2026-10-01' },
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
