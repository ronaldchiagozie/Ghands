import { cacheDevAuthTokenForRole } from '../../utils/devAuthTokens';
import { extractUserIdFromToken } from '../../utils/tokenUtils';
import { authService as authServiceInstance } from '../authService';
import { apiClient } from './client';
import type {
  UserSignupPayload,
  UserSignupResponse,
  UserLoginPayload,
  UserLoginResponse,
  CompanySignupPayload,
  CompanySignupResponse,
} from './types';

export type { UserSignupPayload, UserSignupResponse, UserLoginPayload, UserLoginResponse, CompanySignupPayload, CompanySignupResponse };

export const authService = {
  userSignup: async (payload: UserSignupPayload): Promise<UserSignupResponse> => {
    try {
      const response = await apiClient.post<any>('/api/user/signup', payload, { skipAuth: true });
      const responseAny = response as any;
      const token = response.data?.data?.token || responseAny.data?.token || responseAny.token;
      const email = response.data?.data?.email || responseAny.data?.email || responseAny.email || payload.email;
      const userId = (response.data?.data as any)?.id || (response.data?.data as any)?.userId || (response.data as any)?.id || (response as any)?.id;
      if (userId) await authServiceInstance.setUserId(userId);
      if (!token) {
        if (userId && email) return { email, token: '', id: userId, firstName: '', lastName: '' };
        throw new Error('Signup failed: No user data or token received from server.');
      }
      await authServiceInstance.setAuthToken(token);
      await cacheDevAuthTokenForRole('client', token);
      const { schedulePushSyncAfterAuth } = await import('@/utils/pushNotifications');
      schedulePushSyncAfterAuth();
      if (!userId && token.split('.').length === 3) {
        const extracted = extractUserIdFromToken(token);
        if (extracted) await authServiceInstance.setUserId(extracted);
      }
      return { email: email || payload.email, token, id: userId, firstName: '', lastName: '' };
    } catch (error: any) {
      throw error;
    }
  },

  companySignup: async (payload: CompanySignupPayload): Promise<CompanySignupResponse> => {
    try {
      const signupPayload = {
        email: payload.email.trim().toLowerCase(),
        phoneNumber: payload.phoneNumber.trim(),
        password: payload.password,
      };
      const response = await apiClient.post<any>('/api/provider/signup', signupPayload, { skipAuth: true });
      const token = response?.data?.data?.token || response?.data?.token || response?.token;
      const companyData = response?.data?.data || response?.data || response;
      const companyId = companyData?.id || companyData?.companyId || (response as any)?.id;
      if (!token) throw new Error('Signup failed: No token received from server.');
      await authServiceInstance.setAuthToken(token);
      const { schedulePushSyncAfterAuth } = await import('@/utils/pushNotifications');
      schedulePushSyncAfterAuth();
      let finalCompanyId: number | undefined = undefined;
      if (companyId) {
        finalCompanyId = typeof companyId === 'number' ? companyId : parseInt(companyId.toString(), 10);
        await authServiceInstance.setCompanyId(finalCompanyId);
      } else if (token) {
        const extracted = extractUserIdFromToken(token);
        if (extracted) {
          finalCompanyId = extracted;
          await authServiceInstance.setCompanyId(finalCompanyId);
        }
      }
      if (finalCompanyId) await authServiceInstance.setUserId(finalCompanyId);
      return {
        id: finalCompanyId || companyId || 0,
        companyName: companyData?.companyName || companyData?.name || payload.email.split('@')[0] || 'Company',
        companyEmail: companyData?.companyEmail || companyData?.email || payload.email,
        companyPhoneNumber: companyData?.companyPhoneNumber || companyData?.phoneNumber || payload.phoneNumber,
        token,
      };
    } catch (error: any) {
      throw error;
    }
  },

  userLogin: async (payload: UserLoginPayload): Promise<UserLoginResponse> => {
    try {
      const response = await apiClient.post<any>('/api/user/login', payload, { skipAuth: true });
      const responseHeaders = (response as any)?.__headers || {};
      const tokenFromHeader = responseHeaders?.['authorization'] || responseHeaders?.['Authorization'] || responseHeaders?.['x-auth-token'];
      const token = response?.data?.data?.token || response?.data?.token || response?.token ||
        (tokenFromHeader?.startsWith('Bearer ') ? tokenFromHeader.substring(7) : tokenFromHeader);
      const email = response?.data?.data?.email || response?.data?.email || response?.user?.email || (response as any)?.email || payload.email;
      const id = response?.data?.data?.id || response?.data?.data?.userId || response?.data?.id || response?.user?.id || (response as any)?.id;
      const firstName = response?.data?.data?.firstName || response?.data?.firstName || response?.user?.firstName;
      const lastName = response?.data?.data?.lastName || response?.data?.lastName || response?.user?.lastName;
      if (id) await authServiceInstance.setUserId(id);
      if (!token) {
        if (id && email) return { email, token: '', id, firstName, lastName };
        throw new Error('Login failed: No user data or token received from server.');
      }
      await authServiceInstance.setAuthToken(token);
      await cacheDevAuthTokenForRole('client', token);
      const { schedulePushSyncAfterAuth } = await import('@/utils/pushNotifications');
      schedulePushSyncAfterAuth();
      if (!id) {
        const extracted = extractUserIdFromToken(token);
        if (extracted) await authServiceInstance.setUserId(extracted);
      }
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('@ghands:user_role', 'client');
      return { email, token, id, firstName, lastName };
    } catch (error: any) {
      throw error;
    }
  },

  login: async (email: string, password: string) => authService.userLogin({ email, password }),

  logout: async () => authServiceInstance.clearAuthTokens(),

  setAuthToken: (token: string) => authServiceInstance.setAuthToken(token),
  clearAuthTokens: () => authServiceInstance.clearAuthTokens(),
  getUserId: () => authServiceInstance.getUserId(),
  setUserId: (userId: number) => authServiceInstance.setUserId(userId),
  getCompanyId: () => authServiceInstance.getCompanyId(),
  setCompanyId: (companyId: number) => authServiceInstance.setCompanyId(companyId),
  getAuthToken: () => authServiceInstance.getAuthToken(),
};
