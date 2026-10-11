import { crashReporting } from '@/services/crashReporting';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display a fallback UI
 * Prevents the entire app from crashing when an error occurs
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Report to crash reporting service
    crashReporting.captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    }, 'high');

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          >
            <View className="items-center">
              <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-6">
                <AlertTriangle size={40} color="#EF4444" />
              </View>

              <Text
                className="text-2xl text-black mb-3 text-center"
                style={{ fontFamily: 'Poppins-Bold' }}
              >
                This screen stopped working
              </Text>

              <Text
                className="text-base text-gray-600 mb-6 text-center"
                style={{ fontFamily: 'Poppins-Medium' }}
              >
                {/**
                  * What happened and what to do about it. "Oops! Something went
                  * wrong" followed by an apology for the inconvenience says
                  * neither: it is the tone of a cartoon and the content of a
                  * shrug, on the one screen where somebody is already annoyed
                  * and needs to know whether their job is safe.
                  */}
                Nothing you have booked is affected. Try again, and if it keeps
                happening, restart the app.
              </Text>

              {__DEV__ && this.state.error && (
                <View className="bg-gray-100 rounded-xl p-4 mb-6 w-full">
                  <Text
                    className="text-sm text-red-600 mb-2"
                    style={{ fontFamily: 'Poppins-SemiBold' }}
                  >
                    Error Details (Development Only):
                  </Text>
                  <Text
                    className="text-xs text-gray-700 font-mono"
                    style={{ fontFamily: 'Poppins-Regular' }}
                  >
                    {this.state.error.toString()}
                  </Text>
                  {this.state.errorInfo?.componentStack && (
                    <Text
                      className="text-xs text-gray-600 mt-2 font-mono"
                      style={{ fontFamily: 'Poppins-Regular' }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={this.handleReset}
                className="bg-black rounded-xl py-4 px-8 flex-row items-center"
                activeOpacity={0.8}
              >
                <RefreshCw size={20} color="#FFFFFF" />
                <Text
                  className="text-white text-base ml-2"
                  style={{ fontFamily: 'Poppins-SemiBold' }}
                >
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

