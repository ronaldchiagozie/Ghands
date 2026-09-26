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
jest.mock('@/utils/connectivityCheck', () => ({
  reportApiUnreachable: jest.fn(),
  clearApiUnreachable: jest.fn(),
}));

import { apiClient } from '@/services/api/client';

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

    await expect(apiClient.get('/api/wallet', { timeoutMs: 20, retries: 0 })).rejects.toMatchObject({
      message: expect.stringMatching(/took too long/i),
    });
  });
});
