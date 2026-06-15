import React, { Component, ReactNode } from 'react';
import { AuthError } from '../utils/errors';
import { isInAuthTransition } from '../utils/authNavigationGuard';
import { expireAuthSession } from '../utils/enforceAuthSession';
import Toast from './Toast';

interface Props {
  children: ReactNode;
  router: any;
}

interface State {
  authError: { message: string; visible: boolean };
}

/**
 * AuthErrorBoundary - Catches AuthError and handles navigation + toast
 * 
 * This component wraps the app and catches authentication errors globally.
 * When an AuthError is thrown, it:
 * 1. Shows error toast
 * 2. Clears auth tokens
 * 3. Navigates to appropriate login screen
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      authError: { message: '', visible: false },
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    if (error instanceof AuthError) {
      return {
        authError: {
          message: error.message || 'Your session has expired. Please sign in again.',
          visible: true,
        },
      };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error instanceof AuthError) {
      this.handleAuthError(error);
    }
  }

  handleAuthError = async (_error: AuthError) => {
    if (isInAuthTransition()) return;
    await expireAuthSession();
  };

  render() {
    return (
      <>
        {this.props.children}
        <Toast
          message={this.state.authError.message}
          type="error"
          visible={this.state.authError.visible}
          onClose={() => this.setState({ authError: { message: '', visible: false } })}
        />
      </>
    );
  }
}
