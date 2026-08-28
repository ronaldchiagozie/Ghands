import { API_BASE_URL } from '@/lib/apiConfig';
/**
 * Performance monitoring service for tracking app performance metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  tags?: Record<string, string>;
}

interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceService {
  private enabled: boolean;
  private marks: Map<string, PerformanceMark> = new Map();
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 100;

  constructor() {
    this.enabled = !__DEV__; // Only enable in production or when explicitly enabled
    this.setupPerformanceObserver();
  }

  /**
   * Setup performance observer for automatic metric collection
   */
  private setupPerformanceObserver() {
    // Monitor React Native performance
    // This is a placeholder - actual implementation depends on your needs
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: entry.name,
              value: entry.duration || 0,
              unit: 'ms',
            });
          }
        });
        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        // PerformanceObserver might not be available
        if (__DEV__) {
          console.warn('PerformanceObserver not available:', error);
        }
      }
    }
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getNow(): number {
    if (typeof global !== 'undefined' && (global as any).performance && (global as any).performance.now) {
      return (global as any).performance.now();
    }
    return Date.now();
  }

  /**
   * Start a performance mark
   */
  mark(name: string): void {
    const startTime = this.getNow();
    this.marks.set(name, {
      name,
      startTime,
    });
  }

  /**
   * End a performance mark and record the duration
   */
  measure(name: string, startMark?: string): number | null {
    const endTime = this.getNow();
    const mark = startMark ? this.marks.get(startMark) : this.marks.get(name);
    
    if (!mark) {
      if (__DEV__) {
        console.warn(`Performance mark "${name}" not found`);
      }
      return null;
    }

    const duration = endTime - mark.startTime;
    
    this.marks.set(name, {
      ...mark,
      endTime,
      duration,
    });

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
    });

    return duration;
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.enabled) {
      return;
    }

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Send to analytics/backend if needed
    this.sendMetric(metric);
  }

  /**
   * Send metric to backend
   */
  private async sendMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const apiUrl = API_BASE_URL;
      await fetch(`${apiUrl}/performance/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...metric,
          timestamp: new Date().toISOString(),
          platform: 'mobile',
        }),
      });
    } catch (error) {
      // Silently fail to avoid performance monitoring affecting performance
      if (__DEV__) {
        if (__DEV__) console.log('Performance:', metric.name);
      }
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(name: string): number | null {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) {
      return null;
    }

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }
}

export const performance = new PerformanceService();

// Note: For HOC usage, import React separately in the file where you use it
// Example:
// import React from 'react';
// import { withPerformanceTracking } from '@/services/performance';

