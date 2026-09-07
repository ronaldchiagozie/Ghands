import { AuthError } from '../../utils/errors';
import { authService as authServiceInstance } from '../authService';
import { assertValidAuthToken, expireAuthSession } from '../../utils/enforceAuthSession';
import { reportApiUnreachable, clearApiUnreachable } from '../../utils/connectivityCheck';
import { API_BASE_URL } from '../../lib/apiConfig';

interface RequestConfig extends RequestInit {
  retries?: number;
  retryDelay?: number;
  skipAuth?: boolean;
}

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

class ApiClient {
  private baseUrl: string;
  private requestInterceptors: Array<(config: RequestConfig) => RequestConfig | Promise<RequestConfig>> = [];
  private responseInterceptors: Array<(response: Response) => Response | Promise<Response>> = [];
  private errorInterceptors: Array<(error: Error) => Error | Promise<Error>> = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.setupDefaultInterceptors();
  }

  private setupDefaultInterceptors() {
    this.addRequestInterceptor(async (config) => {
      if (!config.skipAuth) {
        const token = await assertValidAuthToken();
        const existingHeaders = config.headers || {};
        const headersObj: Record<string, string> = existingHeaders instanceof Headers
          ? Object.fromEntries(existingHeaders.entries())
          : { ...(existingHeaders as Record<string, string>) };
        const contentType = headersObj['Content-Type'] || headersObj['content-type'] || 'application/json';
        /**
         * Spread the caller's headers rather than replacing them. This used to
         * build a fresh object from Content-Type and Authorization alone, so any
         * custom header was silently dropped - Idempotency-Key included, which
         * would have looked wired up in the client and never reached the server.
         */
        config.headers = {
          ...headersObj,
          'Content-Type': contentType,
          Authorization: `Bearer ${token}`,
        } as HeadersInit;
      }
      return config;
    });
  }

  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: Response) => Response | Promise<Response>) {
    this.responseInterceptors.push(interceptor);
  }

  addErrorInterceptor(interceptor: (error: Error) => Error | Promise<Error>) {
    this.errorInterceptors.push(interceptor);
  }

  private isAuthError(error: any): boolean {
    if (error instanceof AuthError) return true;
    const status = error?.status || error?.response?.status;
    const message = (error?.message || error?.details?.data?.error || error?.details?.error || '').toLowerCase();
    return (
      // 403 is a permission failure, not a broken session; see the 401 handling below.
      status === 401 ||
      message.includes('unauthorized') || message.includes('invalid token') ||
      message.includes('token expired') || message.includes('not authenticated') ||
      message.includes('no authorization token') || message.includes('no token') ||
      message.includes('authentication required') || message.includes('session expired')
    );
  }

  /**
   * Asks one endpoint a signed-in customer can always reach.
   *
   * True means the token really is dead. False means the 401 belonged to
   * whatever was being called, not to the session, and the caller gets an
   * ordinary error to show instead of being thrown out.
   */
  private async confirmSessionRejected(): Promise<boolean> {
    try {
      const token = await authServiceInstance.getAuthToken();
      if (!token) return true;

      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status === 401;
    } catch {
      return false;
    }
  }

  private async refreshAuthToken(): Promise<boolean> {
    try {
      const refreshToken = await authServiceInstance.getRefreshToken();
      if (!refreshToken) return false;
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        await authServiceInstance.setAuthToken(data.accessToken);
        if (data.refreshToken) await authServiceInstance.setRefreshToken(data.refreshToken);
        return true;
      }
    } catch {
      // Token refresh failed - AuthError will be thrown in retryRequest
    }
    return false;
  }

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }
    return processedConfig;
  }

  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let processedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }
    return processedResponse;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isNetworkError(error: any): boolean {
    if (!error) return false;
    /**
     * `TypeError` used to count on its own. A failed fetch in React Native is a
     * TypeError, so that caught the real case - along with every ordinary bug
     * that throws one inside this try block, which would then be reported to the
     * user as "you have no internet". The message check below already catches
     * the genuine fetch failures by name.
     */
    if (error.name === 'NetworkError') return true;
    const errorMessage = (error.message || error.toString() || '').toLowerCase();
    return errorMessage.includes('network request failed') || errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') || errorMessage.includes('network error') ||
      errorMessage.includes('econnrefused') || errorMessage.includes('enotfound') ||
      errorMessage.includes('timeout') || errorMessage.includes('network connection') ||
      errorMessage.includes('no internet') || errorMessage.includes('offline') ||
      (errorMessage.includes('typeerror') && errorMessage.includes('fetch'));
  }

  private async retryRequest<T>(
    url: string,
    config: RequestConfig,
    retries: number,
    retryDelay: number,
    retriedAfterRefresh = false,
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const fetchConfig = await this.applyRequestInterceptors({ ...config });
        const { retries: _r, retryDelay: _d, skipAuth, ...rawFetchOptions } = fetchConfig;
        const response = await fetch(url, rawFetchOptions);

        if (
          response.status === 401 &&
          !skipAuth &&
          !retriedAfterRefresh
        ) {
          const refreshed = await this.refreshAuthToken();
          if (refreshed) {
            return this.retryRequest<T>(url, config, retries, retryDelay, true);
          }

          /**
           * Confirm before ending the session.
           *
           * A single endpoint refusing us is not the server's verdict on the
           * session. The provider app had exactly this block and it signed
           * people out on the first 401 from anything, because the refresh
           * above could never succeed until the backend started returning a
           * refresh token at login.
           *
           * Asking one call a signed-in customer is known to reach settles it,
           * and only a clean 401 there counts. A timeout or a cold server says
           * nothing about a token.
           */
          const sessionReallyOver = await this.confirmSessionRejected();
          if (!sessionReallyOver) {
            const err = new Error('You do not have access to that.') as any;
            err.status = 401;
            throw err;
          }

          await expireAuthSession();
          throw new AuthError('Your session has expired. Please sign in again.');
        }

        if (!response.ok) {
          const statusCode = response.status;
          const isRetryable = DEFAULT_RETRY_OPTIONS.retryableStatusCodes?.includes(statusCode);
          const isServerError = statusCode >= 500 && statusCode < 600;
          if (isRetryable && !isServerError && attempt < retries) {
            await this.sleep(retryDelay * Math.pow(2, attempt));
            continue;
          }
          let errorMessage = `Request failed with status ${statusCode}`;
          let errorDetails: any = null;
          try {
            const responseClone = response.clone();
            const contentType = response.headers.get('content-type') || '';
            const text = await responseClone.text();
            if (text && (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html'))) {
              const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
              const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
              const scraped = (preMatch?.[1] ?? titleMatch?.[1] ?? '').trim();
              errorMessage = 'The server could not be reached. Please try again in a moment.';
              const err = new Error(errorMessage) as any;
              err.status = statusCode;
              err.statusText = response.statusText;
              err.details = { htmlResponse: text.substring(0, 500), scrapedTitle: scraped || undefined };
              throw err;
            }
            try {
              const errorData = JSON.parse(text);
              errorDetails = errorData;
              if (errorData.data?.error) errorMessage = errorData.data.error;
              else if (errorData.error) errorMessage = errorData.error;
              else if (errorData.message) errorMessage = errorData.message;
            } catch {
              if (text && text.length < 500) errorMessage = text;
            }
          } catch { /* use default errorMessage */ }
          const err = new Error(errorMessage) as any;
          err.status = statusCode;
          err.statusText = response.statusText;
          err.details = errorDetails;
          err.code = extractErrorCode(errorDetails);
          throw err;
        }
        const processedResponse = await this.applyResponseInterceptors(response);
        const jsonData = await processedResponse.json();
        clearApiUnreachable();
        if (processedResponse.url?.includes('/login')) {
          const headers: any = {};
          processedResponse.headers.forEach((value, key) => { headers[key] = value; });
          (jsonData as any).__headers = headers;
        }
        return jsonData;
      } catch (error) {
        if (error instanceof AuthError) throw error;
        const isNetworkErr = this.isNetworkError(error);
        if (isNetworkErr && attempt < retries) {
          await this.sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }
        if (attempt === retries) {
          if (error instanceof AuthError) throw error;
          const errorMessage = isNetworkErr
            ? 'No internet connection. Check your network and try again.'
            : (error instanceof Error ? error.message : 'Request failed');
          const statusCode = (error as any)?.status || (error as any)?.response?.status;
          if (isNetworkErr) {
            reportApiUnreachable();
          }
          if (
            !isNetworkErr &&
            !config.skipAuth &&
            /**
             * 401 only. A 403 used to end the session too, which is wrong: it
             * means "you are signed in and not allowed to do this", not "your
             * session is invalid". Clearing the tokens on one signs somebody out
             * of a working account because of a single forbidden request.
             *
             * The backend now returns 403 PROVIDER_NOT_VERIFIED on gated
             * endpoints, which made this a trap: an unverified provider opening
             * the jobs or profile tab was signed out on the spot, and could
             * never stay in long enough to finish verifying. A 403 is thrown to
             * the caller with its code so the screen can say what is actually
             * wrong.
             */
            statusCode === 401 &&
            retriedAfterRefresh
          ) {
            await expireAuthSession();
            throw new AuthError('Your session has expired. Please sign in again.');
          }
          const isExpected500 = statusCode === 500;
          const errorObj = error instanceof Error
            ? Object.assign(new Error(errorMessage), {
                message: errorMessage,
                isNetworkError: isNetworkErr,
                originalError: error,
                status: statusCode,
                details: (error as any)?.details,
                isExpected500: isExpected500,
                suppressErrorLog: isExpected500,
              })
            : new Error(errorMessage);
          throw errorObj;
        }
        await this.sleep(retryDelay * Math.pow(2, attempt));
      }
    }
    throw new Error('Request failed after all retry attempts.');
  }

  private async request<T>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultConfig: RequestConfig = {
      headers: { 'Content-Type': 'application/json' },
      retries: DEFAULT_RETRY_OPTIONS.maxRetries,
      retryDelay: DEFAULT_RETRY_OPTIONS.retryDelay,
      ...options,
    };
    const { retries, retryDelay = 1000 } = defaultConfig;
    /**
     * An explicit `retries: 0` must be honoured - money-moving POSTs opt out of
     * retries entirely (see NO_RETRY in services/api/wallet.ts). Treating 0 as
     * "unset" would silently re-send a debit the server may already have applied.
     */
    const effectiveRetries =
      typeof retries === 'number' && retries >= 0
        ? retries
        : DEFAULT_RETRY_OPTIONS.maxRetries ?? 2;
    return this.retryRequest<T>(url, defaultConfig, effectiveRetries, retryDelay);
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data ? JSON.stringify(data) : undefined });
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data ? JSON.stringify(data) : undefined });
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body: data ? JSON.stringify(data) : undefined });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

/**
 * Pulls the payload out of the API envelope, tolerating either nesting depth.
 *
 * The API is moving from `{ success, message, data: { data: PAYLOAD } }` to
 * `{ success, message, data: PAYLOAD }`. Callers that unwrap with their own
 * `?.data?.data ?? ?.data ?? …` chain already survive both, but ones that use
 * this helper alone did not: getRequestDetails returned the wrapper instead of
 * the request under the old shape.
 *
 * A lone `{ data: X }` is an envelope layer and gets peeled. A payload that
 * carries `data` alongside other fields is left alone, so nothing that
 * legitimately has a `data` property is unwrapped by mistake. That makes the
 * two server shapes indistinguishable to every caller, and the deploy order
 * between server and apps no longer matters.
 */
function isBareDataWrapper(value: any): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'data' in value &&
    Object.keys(value).length === 1
  );
}

/**
 * Pulls the backend's stable error code off a failed response.
 *
 * The apps have been matching on English message text ("Invalid PIN"), which
 * breaks the moment someone rewords a string. The backend now sends a machine
 * readable `code` alongside the message; it is looked for at each nesting level
 * because the error envelope has not been as consistent as the success one.
 */
export function extractErrorCode(body: any): string | undefined {
  const candidates = [body?.code, body?.data?.code, body?.error?.code, body?.data?.error?.code];
  const code = candidates.find((value) => typeof value === 'string' && value.trim());
  return code ? code.trim() : undefined;
}

export function extractResponseData<T>(response: any): T {
  if (Array.isArray(response)) return response as T;
  if (Array.isArray(response?.data)) return response.data as T;
  if (Array.isArray(response?.data?.data)) return response.data.data as T;
  if (response?.data !== undefined) {
    return (isBareDataWrapper(response.data) ? response.data.data : response.data) as T;
  }
  return response as T;
}
