/**
 * Custom error class for authentication-related errors
 * 
 * Use this when:
 * - Token is expired or invalid
 * - User is not authenticated
 * - Authorization fails (401 errors)
 * 
 * Example:
 * ```typescript
 * try {
 *   await apiClient.get('/protected-endpoint');
 * } catch (error) {
 *   if (error instanceof AuthError) {
 *     // Handle auth error - redirect to login, show toast, etc.
 *     router.replace('/LoginScreen');
 *   }
 * }
 * ```
 */
export class AuthError extends Error {
  constructor(message: string = 'Authentication error') {
    super(message);
    this.name = 'AuthError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError || (error instanceof Error && error.name === 'AuthError');
}

/**
 * Custom error class for network-related errors
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network error') {
    super(message);
    this.name = 'NetworkError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkError);
    }
  }
}
