/**
 * When the app is allowed to take over the screen with "no connection".
 *
 * The backend sleeps when idle, and its first request after that can time out
 * while it wakes. That was enough to throw a full-screen takeover over an app
 * that was about to work fine — five seconds into a cold start, with nothing in
 * the logs, because the error itself was swallowed by the caller.
 */
const mockFetchState = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: mockFetchState, addEventListener: jest.fn() },
}));

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('the offline latch', () => {
  let mod: any;
  let listener: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetchState.mockResolvedValue({ isConnected: true });
    mod = require('@/utils/connectivityCheck');
    listener = jest.fn();
    mod.subscribeApiUnreachable(listener);
  });

  /** The reported bug: one slow request must not raise the screen. */
  it('stays quiet when the server answers the confirming request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as any;

    mod.reportApiUnreachable();
    await flush();
    await flush();

    expect(listener).not.toHaveBeenCalled();
    expect(mod.isApiUnreachable()).toBe(false);
  });

  /** Any reply at all means we can reach them, including an error status. */
  it('treats a 500 as reachable, because it is', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 500 }) as any;

    mod.reportApiUnreachable();
    await flush();
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('raises it when the server really cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as any;

    mod.reportApiUnreachable();
    await flush();
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(mod.isApiUnreachable()).toBe(true);
  });

  /**
   * NetInfo already covers a genuinely offline device, and this latch is what
   * distinguishes "ours is down" from "yours is" — so it must not fire here, or
   * the screen cannot tell the two apart.
   */
  it('leaves a genuinely offline device to NetInfo', async () => {
    mockFetchState.mockResolvedValue({ isConnected: false });
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as any;

    mod.reportApiUnreachable();
    await flush();
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not announce the same outage twice', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as any;

    mod.reportApiUnreachable();
    await flush();
    await flush();
    mod.reportApiUnreachable();
    await flush();
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears once anything succeeds again', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as any;
    mod.reportApiUnreachable();
    await flush();
    await flush();
    expect(mod.isApiUnreachable()).toBe(true);

    mod.clearApiUnreachable();
    expect(mod.isApiUnreachable()).toBe(false);
  });
});
