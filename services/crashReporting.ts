import { API_BASE_URL } from '@/lib/apiConfig';
/**
 * Crash reporting service for tracking and reporting app crashes
 * Supports multiple crash reporting providers (can be extended)
 */

interface CrashReport {
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

class CrashReportingService {
  private enabled: boolean;
  private userId: string | null = null;
  private providers: Array<(report: CrashReport) => void> = [];

  constructor() {
    this.enabled = !__DEV__; // Only enable in production
    this.setupProviders();
  }

  /**
   * Setup crash reporting providers
   * Add your crash reporting SDK initialization here (e.g., Sentry, Bugsnag, etc.)
   */
  private setupProviders() {
    if (!this.enabled) {
      return;
    }

    // Example: Sentry
    // import * as Sentry from '@sentry/react-native';
    // Sentry.init({
    //   dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // });
    // this.providers.push((report) => {
    //   Sentry.captureException(new Error(report.message), {
    //     extra: report.context,
    //     user: report.userId ? { id: report.userId } : undefined,
    //   });
    // });

    // Example: Custom crash reporting endpoint
    this.providers.push(async (report) => {
      try {
        const apiUrl = API_BASE_URL;
        await fetch(`${apiUrl}/crash-reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...report,
            timestamp: new Date().toISOString(),
            platform: 'mobile',
            appVersion: '1.0.0', // You can get this from expo-constants
          }),
        });
      } catch (error) {
        // Silently fail to avoid crash reporting causing crashes
        if (__DEV__) {
          console.error('Error reporting crash:', error);
        }
      }
    });
  }

  /**
   * Report a crash or error
   */
  captureException(error: Error, context?: Record<string, any>, severity: CrashReport['severity'] = 'medium') {
    const report: CrashReport = {
      message: error.message,
      stack: error.stack,
      context,
      userId: this.userId || undefined,
      severity,
    };

    this.providers.forEach((provider) => {
      try {
        provider(report);
      } catch (err) {
        // Silently fail to avoid crash reporting causing crashes
        if (__DEV__) {
          console.error('Error in crash reporting provider:', err);
        }
      }
    });
  }

  /**
   * Report a message (non-error)
   */
  captureMessage(message: string, context?: Record<string, any>, severity: CrashReport['severity'] = 'low') {
    const report: CrashReport = {
      message,
      context,
      userId: this.userId || undefined,
      severity,
    };

    this.providers.forEach((provider) => {
      try {
        provider(report);
      } catch (err) {
        if (__DEV__) {
          console.error('Error in crash reporting provider:', err);
        }
      }
    });
  }

  /**
   * Set user context
   */
  setUser(userId: string, traits?: Record<string, any>) {
    this.userId = userId;
    // Update user context in providers
    // Example: Sentry.setUser({ id: userId, ...traits });
  }

  /**
   * Clear user context
   */
  clearUser() {
    this.userId = null;
    // Clear user context in providers
    // Example: Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(_message: string, _category?: string, _data?: Record<string, any>) {
    // Add breadcrumb to providers
    // Example: Sentry.addBreadcrumb({ message, category, data });
  }
}

export const crashReporting = new CrashReportingService();

// Global error handler
if (typeof global !== 'undefined') {
  const globalAny = global as any;
  const originalErrorHandler = globalAny.ErrorUtils?.getGlobalHandler?.();
  
  if (globalAny.ErrorUtils) {
    globalAny.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      crashReporting.captureException(error, { isFatal }, isFatal ? 'critical' : 'high');
      
      // Call original handler
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
  }
}

