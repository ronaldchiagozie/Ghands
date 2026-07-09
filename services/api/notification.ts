import { apiClient, extractResponseData } from './client';

import type { Notification, NotificationsListResult } from './types';

export type { Notification, NotificationsListResult };

export type RegisterPushTokenPayload = {
  pushToken: string;
  platform: 'ios' | 'android';
  provider: 'expo';
  deviceLabel: string;
};

export type PushDevice = {
  id?: number;
  pushToken: string;
  platform?: string;
  provider?: string;
  deviceLabel?: string;
  isActive?: boolean;
  lastSeenAt?: string;
  createdAt?: string;
};

export const notificationService = {
  getNotifications: async (options?: { limit?: number; offset?: number; status?: 'unread' | 'read' | 'all' }): Promise<NotificationsListResult> => {
    const { limit = 50, offset = 0, status = 'unread' } = options || {};
    const baseQuery = `?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    const statusQuery = status && status !== 'all' ? `${baseQuery}&status=${encodeURIComponent(status)}` : baseQuery;
    let response = await apiClient.get<any>(`/api/notifications${statusQuery}`);
    let responseData = extractResponseData<any>(response);
    let innerData = responseData?.data?.data || responseData?.data || responseData;
    let notifications: Notification[] = innerData?.notifications || [];
    if (notifications.length === 0 && status === 'unread') {
      response = await apiClient.get<any>(`/api/notifications${baseQuery}`);
      responseData = extractResponseData<any>(response);
      innerData = responseData?.data?.data || responseData?.data || responseData;
      notifications = innerData?.notifications || [];
    }
    return {
      notifications,
      total: innerData?.total ?? notifications.length,
      limit: innerData?.limit ?? limit,
      offset: innerData?.offset ?? offset,
    };
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<any>('/api/notifications/unread-count');
    const responseData = extractResponseData<any>(response);
    const innerData = responseData?.data?.data || responseData?.data || responseData;
    return innerData?.unreadCount ?? 0;
  },

  markAsRead: async (notificationId: number): Promise<void> => {
    await apiClient.patch<any>(`/api/notifications/${notificationId}/read`, {});
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch<any>('/api/notifications/read-all', {});
  },

  deleteNotification: async (notificationId: number): Promise<void> => {
    await apiClient.delete<any>(`/api/notifications/${notificationId}`);
  },

  deleteAllNotifications: async (): Promise<void> => {
    await apiClient.delete<any>('/api/notifications');
  },

  /** Register or update this device's Expo push token (upsert). */
  registerPushToken: async (payload: RegisterPushTokenPayload): Promise<void> => {
    await apiClient.post<any>('/api/notifications/push-token', payload);
  },

  /** Remove device from push delivery on logout or when user disables notifications. */
  unregisterPushToken: async (pushToken: string): Promise<void> => {
    await apiClient.post<any>('/api/notifications/devices/unregister', { pushToken });
  },

  listDevices: async (activeOnly = true): Promise<PushDevice[]> => {
    const response = await apiClient.get<any>(
      `/api/notifications/devices?activeOnly=${activeOnly ? 'true' : 'false'}`,
    );
    const responseData = extractResponseData<any>(response);
    const inner = responseData?.data?.data || responseData?.data || responseData;
    const list = Array.isArray(inner) ? inner : inner?.devices || [];
    return list as PushDevice[];
  },
};
