import { exitChatToJobHub } from '@/utils/navigation';

describe('exitChatToJobHub', () => {
  it('pops back when chat was opened from job hub', () => {
    const back = jest.fn();
    const replace = jest.fn();
    const push = jest.fn();
    const router = {
      canGoBack: () => true,
      back,
      replace,
      push,
    };

    exitChatToJobHub(router as never, {
      requestId: 42,
      fromJobHub: '1',
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces with job details when not from job hub', () => {
    const back = jest.fn();
    const replace = jest.fn();
    const push = jest.fn();
    const router = {
      canGoBack: () => true,
      back,
      replace,
      push,
    };

    exitChatToJobHub(router as never, {
      requestId: 42,
      fromJobHub: undefined,
    });

    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });
});
