jest.mock('@/services/authService', () => ({
  authService: {
    getAuthToken: jest.fn(async () => 'token'),
    getRefreshToken: jest.fn(async () => null),
    setAuthToken: jest.fn(async () => undefined),
    setRefreshToken: jest.fn(async () => undefined),
  },
}));
jest.mock('@/utils/enforceAuthSession', () => ({
  assertValidAuthToken: jest.fn(),
  expireAuthSession: jest.fn(async () => undefined),
}));
jest.mock('@/utils/connectivityCheck', () => {
  /** Mutable, so a test can put the phone offline and back. */
  let online = true;
  return {
    reportApiUnreachable: jest.fn(),
    clearApiUnreachable: jest.fn(),
    isDeviceOnline: () => online,
    setDeviceOnline: (next: boolean) => {
      online = next;
    },
  };
});

import { apiClient } from '@/services/api/client';
import { setDeviceOnline } from '@/utils/connectivityCheck';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: 'https://api.test/x',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      forEach: () => undefined,
    },
    clone() {
      return this;
    },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

describe('when the server answers with an error', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('asks once, not four times, for an answer that will not change', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Missing job details' }));

    await expect(apiClient.post('/api/request-service/requests/1/confirm', {})).rejects.toMatchObject({
      status: 400,
      message: 'Missing job details',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the error code screens branch on', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { code: 'MISSING_SCHEDULE', message: 'Pick a date' }));

    await expect(apiClient.post('/api/request-service/requests/1/confirm', {})).rejects.toMatchObject({
      code: 'MISSING_SCHEDULE',
    });
  });

  it('still retries when told to slow down', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { message: 'Too many requests' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));

    await expect(apiClient.get('/api/wallet', { retryDelay: 1 })).resolves.toEqual({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a server that never answers instead of loading forever', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    /**
     * Named as a slow server, not as a slow connection. The old wording
     * ended "please check your connection and try again", which points the
     * customer at their own network for a timeout that is usually ours -
     * the backend sleeps when idle and its first call can take twenty
     * seconds.
     */
    await expect(apiClient.get('/api/wallet', { timeoutMs: 20, retries: 0 })).rejects.toMatchObject({
      message: expect.stringMatching(/taking too long/i),
    });
  });
});

/**
 * The app used to say "No internet connection. Check your network and try
 * again." for both a phone with no signal and a server that would not
 * answer. So it put that in a toast while the screen behind it correctly
 * read "Your internet is fine, we can't reach our servers" - two
 * contradictory statements at once, and the one blaming the customer's
 * network was the wrong one.
 */
describe('blaming the right thing when a request fails', () => {
  const unreachable = () =>
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('Network request failed')),
    );

  afterEach(() => {
    setDeviceOnline(true);
  });

  it('blames the server when the phone has a connection', async () => {
    unreachable();
    setDeviceOnline(true);

    await expect(apiClient.get('/api/wallet', { retries: 0 })).rejects.toMatchObject({
      message: expect.stringMatching(/can't reach ghands/i),
    });
  });

  it('blames the network only when the phone really is offline', async () => {
    unreachable();
    setDeviceOnline(false);

    await expect(apiClient.get('/api/wallet', { retries: 0 })).rejects.toMatchObject({
      message: expect.stringMatching(/no internet connection/i),
    });
  });
});
