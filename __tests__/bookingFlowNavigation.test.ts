import { navigateBookingStepBack } from '@/utils/bookingFlowNavigation';

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
