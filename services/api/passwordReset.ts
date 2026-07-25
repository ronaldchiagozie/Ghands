import { apiClient, extractResponseData } from './client';

export const passwordResetService = {
  forgotPassword: async (email: string): Promise<void> => {
    const response = await apiClient.post<any>(
      '/api/user/forgot-password',
      { email: email.trim().toLowerCase() },
      { skipAuth: true },
    );
    extractResponseData(response);
  },

  verifyResetOtp: async (email: string, otp: string): Promise<void> => {
    const response = await apiClient.post<any>(
      '/api/user/verify-reset-otp',
      {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      },
      { skipAuth: true },
    );
    extractResponseData(response);
  },

  resetPassword: async (payload: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> => {
    const response = await apiClient.post<any>(
      '/api/user/reset-password',
      {
        email: payload.email.trim().toLowerCase(),
        otp: payload.otp.trim(),
        newPassword: payload.newPassword,
        confirmPassword: payload.confirmPassword,
      },
      { skipAuth: true },
    );
    extractResponseData(response);
  },
};
