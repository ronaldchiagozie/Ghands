import { navigateBookingStepBack, returnToServiceMap } from '@/utils/bookingFlowNavigation';

const mockRouter = {
  canGoBack: jest.fn(() => false),
  back: jest.fn(),
  replace: jest.fn(),
};

describe('navigateBookingStepBack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns to AI assistant when fromAiAssistant is set', () => {
    navigateBookingStepBack(mockRouter as any, {
      fromAiAssistant: 'true',
      conversationId: '42',
      requestId: '9',
    });

    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/AiAssistantScreen',
        params: { conversationId: '42' },
      }),
    );
  });

  it('returns to service map when editing from map flow', () => {
    navigateBookingStepBack(mockRouter as any, {
      bookingOrigin: 'serviceMap',
      requestId: '55',
      categoryName: 'plumbing',
    });

    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/ServiceMapScreen',
      }),
    );
  });

  it('returns to job details for standard booking flow', () => {
    navigateBookingStepBack(mockRouter as any, {
      bookingOrigin: 'jobDetails',
      requestId: '12',
      categoryName: 'electrical',
    });

    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/JobDetailsScreen',
      }),
    );
  });
});

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
