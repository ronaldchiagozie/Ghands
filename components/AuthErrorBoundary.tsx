import React, { Component, ReactNode } from 'react';
import { AuthError } from '../utils/errors';
import { isInAuthTransition, redirectToAuthScreen } from '../utils/authNavigationGuard';
import { expireAuthSession } from '../utils/enforceAuthSession';

interface Props {
  children: ReactNode;
  router: { replace: (href: any) => void };
}

interface State {
  /** Reserved — auth failures redirect silently (no error toast). */
}

/**
 * Catches AuthError from render trees, clears session, and sends user to login.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): Partial<State> | null {
    if (error instanceof AuthError) {
      return null;
    }
    return null;
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    if (error instanceof AuthError) {
      void this.handleAuthError();
    }
  }

  handleAuthError = async () => {
    if (isInAuthTransition()) return;
    await expireAuthSession();
    await redirectToAuthScreen(this.props.router, {
      clearSession: false,
      force: true,
    });
  };

  render() {
    return this.props.children;
  }
}
