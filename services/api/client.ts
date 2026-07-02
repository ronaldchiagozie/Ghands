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
        config.headers = {
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
      status === 401 || status === 403 ||
      message.includes('unauthorized') || message.includes('invalid token') ||
      message.includes('token expired') || message.includes('not authenticated') ||
      message.includes('no authorization token') || message.includes('no token') ||
      message.includes('authentication required') || message.includes('session expired')
    );
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
    if (error.name === 'NetworkError' || error.name === 'TypeError') return true;
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
              if (preMatch?.[1]) errorMessage = `Server error: ${preMatch[1].trim()}`;
              else if (titleMatch?.[1]) errorMessage = `Server error: ${titleMatch[1].trim()}`;
              else errorMessage = 'Server error: The server encountered an internal error. Please try again later.';
              const err = new Error(errorMessage) as any;
              err.status = statusCode;
              err.statusText = response.statusText;
              err.details = { htmlResponse: text.substring(0, 500) };
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
        const isNetworkErr = this.isNetworkError(error);
        if (isNetworkErr && attempt < retries) {
          await this.sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }
        if (attempt === retries) {
          if (error instanceof AuthError) throw error;
          const errorMessage = isNetworkErr
            ? 'Whoops! No internet connection found. Check your internet connection or try again.'
            : (error instanceof Error ? error.message : 'Request failed');
          const statusCode = (error as any)?.status || (error as any)?.response?.status;
          if (isNetworkErr) {
            reportApiUnreachable();
          }
          // Only 401/403 → session expired. Skip if this failure is really offline / flaky network
          // (avoids mis-classifying connection issues as logout when proxies or DNS act up).
          if (
            !isNetworkErr &&
            !config.skipAuth &&
            ((statusCode === 401 && retriedAfterRefresh) || statusCode === 403)
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
    const { retries = 0, retryDelay = 1000 } = defaultConfig;
    const effectiveRetries = retries > 0 ? retries : DEFAULT_RETRY_OPTIONS.maxRetries || 2;
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

export function extractResponseData<T>(response: any): T {
  if (Array.isArray(response)) return response as T;
  if (Array.isArray(response?.data)) return response.data as T;
  if (Array.isArray(response?.data?.data)) return response.data.data as T;
  if (response?.data !== undefined) return response.data as T;
  return response as T;
}
