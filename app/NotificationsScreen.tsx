import { NotificationCardSkeleton } from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { haptics } from '@/hooks/useHaptics';
import { BorderRadius, Colors, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { Notification, notificationService } from '@/services/api';
import { formatTimeAgo } from '@/utils/dateFormatting';
import {
  notificationActionLabel,
  resolveNotificationRoute,
} from '@/utils/notificationNavigation';
import {
  formatMessageNotificationCopy,
  formatMessageNotificationTitle,
  isMessageNotificationType,
  shouldShowMessageNotification,
} from '@/utils/messageNotificationCopy';
import { authService } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Archive, Bell, Calendar, CheckCheck, Clock, FileText, Handshake, MessageCircle, Trash2, Wallet, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

type NotificationSection = {
  title: UINotificationSection;
  data: UINotification[];
};

type NotificationListItemProps = {
  notification: UINotification;
  isLastInSection: boolean;
  filterPill: FilterPill;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
  onMarkAsRead: (id: number) => void;
  onNavigate: (notification: UINotification) => void;
  setSwipeableRef: (id: number, ref: Swipeable | null) => void;
};

const NotificationListItem = React.memo(function NotificationListItem({
  notification,
  isLastInSection,
  filterPill,
  onArchive,
  onUnarchive,
  onDelete,
  onMarkAsRead,
  onNavigate,
  setSwipeableRef,
}: NotificationListItemProps) {
  const isArchiveTab = filterPill === 'archive';

  return (
    <Swipeable
      ref={(ref) => setSwipeableRef(notification.id, ref)}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <View
          style={{
            flexDirection: 'row',
            marginBottom: isLastInSection ? 0 : 10,
            minHeight: 74,
            alignItems: 'stretch',
          }}
        >
          <TouchableOpacity
            onPress={() => (isArchiveTab ? onUnarchive(notification.id) : onArchive(notification.id))}
            style={{
              width: 72,
              backgroundColor: isArchiveTab ? Colors.accent : Colors.iconMuted,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRadius: BorderRadius.xl,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 6,
            }}
          >
            <Archive size={20} color={Colors.white} />
            <Text style={{ fontSize: 10, fontFamily: 'Poppins-Medium', color: Colors.white, marginTop: 4 }}>
              {isArchiveTab ? 'Unarchive' : 'Archive'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(notification.id)}
            style={{
              width: 72,
              backgroundColor: Colors.error,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderRadius: BorderRadius.xl,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Trash2 size={20} color={Colors.white} />
            <Text style={{ fontSize: 10, fontFamily: 'Poppins-Medium', color: Colors.white, marginTop: 4 }}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          onMarkAsRead(notification.id);
          onNavigate(notification);
        }}
      >
      <View
        style={{
          flexDirection: 'row',
          marginBottom: isLastInSection ? 0 : 10,
          ...providerListCard,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 14,
            backgroundColor: notification.iconBgColor,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {notification.icon && (
            <notification.icon size={18} color={notification.iconColor} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                lineHeight: 17,
              }}
              numberOfLines={1}
            >
              {notification.type}
            </Text>
            {!notification.isRead && (
              <View
                style={{
                  marginLeft: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.accent,
                }}
              />
            )}
          </View>
          {!!notification.description && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginBottom: 8,
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {notification.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                onMarkAsRead(notification.id);
                onNavigate(notification);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: Colors.sageTint,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.accent,
                }}
              >
                View details
              </Text>
            </TouchableOpacity>
            {!notification.isRead && (
              <TouchableOpacity
                onPress={() => onMarkAsRead(notification.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
                activeOpacity={0.7}
              >
                <CheckCheck size={12} color={Colors.textSecondaryDark} style={{ marginRight: 4 }} />
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Mark read
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 8, minWidth: 48 }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 3,
              textAlign: 'right',
            }}
          >
            {notification.time}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Poppins-SemiBold',
              color: notification.isRead ? Colors.textTertiary : Colors.accent,
            }}
          >
            {notification.isRead ? 'Read' : 'New'}
          </Text>
        </View>
      </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

type UINotificationSection = 'Recent' | 'Yesterday' | 'Last week';

interface UINotification {
  id: number;
  isRead: boolean;
  createdAt: string;
  requestId?: number | null;
  quotationId?: number | null;
  transactionId?: number | null;
  type: string;
  description: string;
  icon: any;
  iconBgColor: string;
  iconColor: string;
  time: string;
  section: UINotificationSection;
  raw: Notification;
}

const ARCHIVED_IDS_KEY = '@ghands:notification_archived_ids';

type FilterPill = 'all' | 'unread' | 'read' | 'archive';

const logNotificationDebug = (event: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.log('[GHands Notifications]', event, data ?? '');
  }
};

const logNotificationError = (event: string, error?: unknown) => {
  if (__DEV__) {
    console.error('[GHands Notifications]', event, error ?? '');
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<UINotification | null>(null);
  const [filterPill, setFilterPill] = useState<FilterPill>('all');
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [userRole, setUserRole] = useState<'client' | 'provider'>('client');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  const swipeableRefs = useRef<Map<number, Swipeable | null>>(new Map());

  const hasNotifications = notifications.length > 0;
  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.status !== 'read').length,
    [notifications]
  );

  const getSectionFromDate = (isoDate: string): UINotificationSection => {
    try {
      const created = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return 'Recent';
      if (diffDays === 1) return 'Yesterday';
      return 'Last week';
    } catch {
      return 'Recent';
    }
  };

  useEffect(() => {
    const loadRoleAndIdentity = async () => {
      try {
        const [role, userId, companyId] = await Promise.all([
          AsyncStorage.getItem('@ghands:user_role'),
          authService.getUserId(),
          authService.getCompanyId(),
        ]);
        setUserRole(role === 'provider' ? 'provider' : 'client');
        setCurrentUserId(userId);
        setCurrentCompanyId(companyId);
      } catch {
        setUserRole('client');
        setCurrentUserId(null);
        setCurrentCompanyId(null);
      }
    };
    void loadRoleAndIdentity();
  }, []);

  // Map backend notification type to UI presentation
  const mapNotificationToUI = (notification: Notification): UINotification => {
    // Default UI values
    let typeLabel = notification.title || 'Notification';
    const rawBackendDescription = String(notification.description || notification.message || '').trim();
    let description = rawBackendDescription.replace(/^null[\s:,-]*/i, '').trim();
    let IconComponent: any = FileText;
    let iconBgColor = Colors.border;
    let iconColor = Colors.textPrimary;

    switch (notification.type) {
      case 'deposit_success': {
        typeLabel = 'Deposit Successful';
        const amount = notification.metadata?.amount ?? notification.metadata?.total;
        const amountText =
          typeof amount === 'number'
            ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
            : '';
        description =
          description ||
          (amountText
            ? `${amountText} has been successfully deposited to your wallet.`
            : 'Your deposit has been successfully completed and added to your wallet balance.');
        IconComponent = Wallet;
        iconBgColor = Colors.successLight;
        iconColor = Colors.successIcon;
        break;
      }
      case 'quotation_sent': {
        typeLabel = 'Quotation Sent';
        const total = notification.metadata?.total;
        const totalText =
          typeof total === 'number'
            ? `₦${total.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
            : '';
        description =
          description ||
          (totalText
            ? `A provider has sent you a quotation with a total amount of ${totalText}.`
            : 'A provider has sent you a new quotation. Please review and decide whether to accept or decline.');
        IconComponent = FileText;
        iconBgColor = Colors.infoLight;
        iconColor = Colors.info;
        break;
      }
      case 'quotation_accepted': {
        // Client-side view: quotation was accepted
        typeLabel = 'Quotation Accepted';
        const total = notification.metadata?.total;
        const totalText =
          typeof total === 'number'
            ? `₦${total.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
            : '';
        description =
          description ||
          (totalText
            ? `You have accepted a quotation for ${totalText}. Proceed to payment to start the job.`
            : 'You have accepted a quotation. Proceed to payment to start the job.');
        IconComponent = Handshake;
        iconBgColor = Colors.successLight;
        iconColor = Colors.successIcon;
        break;
      }
      case 'request_accepted': {
        // Client-side view: provider accepted their request
        typeLabel = 'Request Accepted';
        {
          const providerName = notification.metadata?.providerName || 'A provider';
          description =
            description ||
            `${providerName} has accepted your request. They will review the details and send you a quotation shortly.`;
        }
        IconComponent = Handshake;
        iconBgColor = Colors.warningLight;
        iconColor = Colors.warningForeground;
        break;
      }
      case 'request_received':
      case 'new_request': {
        // Provider-side view: they received a new job request
        typeLabel = 'New Request';
        description =
          description ||
          'You have a new job request. Review the details and decide whether to proceed.';
        IconComponent = FileText;
        iconBgColor = Colors.infoLight;
        iconColor = Colors.info;
        break;
      }
      case 'work_order_issued':
      case 'work_order_created': {
        typeLabel = 'Work order issued';
        description =
          description ||
          'A work order has been issued for this job. Check the schedule and get ready to start.';
        IconComponent = Calendar;
        iconBgColor = Colors.successLight;
        iconColor = Colors.successIcon;
        break;
      }
      case 'payment_released':
      case 'payout_released':
      case 'job_payment_released': {
        typeLabel = 'Payment Released';
        const amount = notification.metadata?.amount ?? notification.metadata?.total;
        const amountText =
          typeof amount === 'number'
            ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
            : '';
        description =
          description ||
          (amountText
            ? `${amountText} has been released for this job. Funds will be available in your wallet shortly.`
            : 'Payment has been released for this job. Funds will be available in your wallet shortly.');
        IconComponent = Wallet;
        iconBgColor = Colors.successLight;
        iconColor = Colors.successIcon;
        break;
      }
      case 'withdrawal_success':
      case 'withdrawal_processed':
      case 'withdrawal_completed': {
        typeLabel = 'Withdrawal Status';
        const amount = notification.metadata?.amount ?? notification.metadata?.total;
        const amountText =
          typeof amount === 'number'
            ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`
            : '';
        description =
          description ||
          (amountText
            ? `Your withdrawal request of ${amountText} has been processed successfully.`
            : 'Your withdrawal request has been processed successfully.');
        IconComponent = Clock;
        iconBgColor = Colors.border;
        iconColor = Colors.inkMuted;
        break;
      }
      default:
        break;
    }

    if (isMessageNotificationType(notification.type)) {
      const messagePerspective = {
        userRole,
        currentUserId,
        currentCompanyId,
        metadata: (notification.metadata ?? null) as Record<string, unknown> | null,
        notificationProviderId: notification.providerId,
        notificationCompanyId: notification.companyId,
        bodyText: rawBackendDescription,
      };
      typeLabel = formatMessageNotificationTitle(notification.title || typeLabel, messagePerspective);
      description =
        formatMessageNotificationCopy(description || rawBackendDescription, messagePerspective) || '';
      IconComponent = MessageCircle;
      iconBgColor = Colors.border;
      iconColor = Colors.inkMuted;
    }

    return {
      id: notification.id,
      isRead: notification.status === 'read',
      createdAt: notification.createdAt,
      requestId: notification.requestId,
      quotationId: notification.quotationId,
      transactionId: notification.transactionId,
      type: typeLabel,
      description,
      icon: IconComponent,
      iconBgColor,
      iconColor,
      time: formatTimeAgo(notification.createdAt),
      section: getSectionFromDate(notification.createdAt),
      raw: notification,
    };
  };

  const uiNotifications = useMemo<UINotification[]>(() => {
    const visible = notifications.filter((notification) => {
      if (!isMessageNotificationType(notification.type)) {
        return true;
      }
      return shouldShowMessageNotification({
        userRole,
        currentUserId,
        currentCompanyId,
        metadata: (notification.metadata ?? null) as Record<string, unknown> | null,
        notificationProviderId: notification.providerId,
        notificationCompanyId: notification.companyId,
        bodyText: String(notification.description || notification.message || ''),
      });
    });
    return visible.map(mapNotificationToUI);
  }, [notifications, userRole, currentUserId, currentCompanyId]);

  const filteredNotifications = useMemo(() => {
    if (filterPill === 'archive') {
      return uiNotifications.filter((n) => archivedIds.has(n.id));
    }
    let list = uiNotifications.filter((n) => !archivedIds.has(n.id));
    if (filterPill === 'unread') list = list.filter((n) => !n.isRead);
    if (filterPill === 'read') list = list.filter((n) => n.isRead);
    return list;
  }, [uiNotifications, filterPill, archivedIds]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<UINotificationSection, UINotification[]> = {
      Recent: [],
      Yesterday: [],
      'Last week': [],
    };
    filteredNotifications.forEach((notif) => {
      groups[notif.section].push(notif);
    });
    return groups;
  }, [filteredNotifications]);

  useEffect(() => {
    logNotificationDebug('filter: updated visible list', {
      activeFilter: filterPill,
      totalBackendNotifications: notifications.length,
      unreadCount,
      archivedCount: archivedIds.size,
      visibleCount: filteredNotifications.length,
      recentCount: groupedNotifications.Recent.length,
      yesterdayCount: groupedNotifications.Yesterday.length,
      lastWeekCount: groupedNotifications['Last week'].length,
    });
  }, [filterPill, notifications.length, unreadCount, archivedIds.size, filteredNotifications.length, groupedNotifications]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch all notifications (both read and unread) to show full history
      // Increase limit to get more notifications
      logNotificationDebug('loadNotifications: starting', { limit: 100, offset: 0 });
      const result = await notificationService.getNotifications({ limit: 100, offset: 0 });
      const nextNotifications = result.notifications || [];
      logNotificationDebug('loadNotifications: success', {
        count: nextNotifications.length,
        unreadCount: nextNotifications.filter((notification) => notification.status !== 'read').length,
        firstNotification: nextNotifications[0]
          ? {
              id: nextNotifications[0].id,
              type: nextNotifications[0].type,
              status: nextNotifications[0].status,
              requestId: nextNotifications[0].requestId,
              providerId: nextNotifications[0].providerId,
              createdAt: nextNotifications[0].createdAt,
            }
          : null,
      });
      setNotifications(nextNotifications);
    } catch (error) {
      logNotificationError('loadNotifications: failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const loadArchivedIds = async () => {
      try {
        const stored = await AsyncStorage.getItem(ARCHIVED_IDS_KEY);
        if (stored) {
          const ids = JSON.parse(stored) as number[];
          setArchivedIds(new Set(ids));
        logNotificationDebug('archive: loaded ids', { count: ids.length, ids });
        }
      } catch (e) {
      logNotificationError('archive: failed to load ids', e);
      }
    };
    loadArchivedIds();
  }, []);

  const persistArchivedIds = useCallback(async (ids: Set<number>) => {
    try {
      await AsyncStorage.setItem(ARCHIVED_IDS_KEY, JSON.stringify([...ids]));
      logNotificationDebug('archive: persisted ids', { count: ids.size, ids: [...ids] });
    } catch (e) {
      logNotificationError('archive: failed to persist ids', e);
    }
  }, []);

  const handleClearAll = async () => {
    if (!hasNotifications || isClearing) return;
    logNotificationDebug('clearAll: starting', { count: notifications.length });
    setIsClearing(true);
    try {
      await notificationService.deleteAllNotifications();
      setNotifications([]);
      logNotificationDebug('clearAll: success');
    } catch (error) {
      logNotificationError('clearAll: failed', error);
    } finally {
      setIsClearing(false);
    }
  };

  const getFilterLabel = (pill: FilterPill) => {
    if (pill === 'all') return `All ${notifications.length}`;
    if (pill === 'unread') return `Unread ${unreadCount}`;
    if (pill === 'read') return `Read ${Math.max(notifications.length - unreadCount, 0)}`;
    return `Archive ${archivedIds.size}`;
  };

  const handleMarkAsRead = async (id: number) => {
    logNotificationDebug('markAsRead: starting', { id });
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
      );
      logNotificationDebug('markAsRead: success', { id });
    } catch (error) {
      logNotificationError('markAsRead: failed', error);
    }
  };

  const handleArchive = useCallback(
    (id: number) => {
      haptics.light();
      logNotificationDebug('archive: add', { id });
      swipeableRefs.current.get(id)?.close();
      setArchivedIds((prev) => {
        const next = new Set(prev).add(id);
        persistArchivedIds(next);
        return next;
      });
    },
    [persistArchivedIds]
  );

  const handleUnarchive = useCallback(
    (id: number) => {
      haptics.light();
      logNotificationDebug('archive: remove', { id });
      swipeableRefs.current.get(id)?.close();
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        persistArchivedIds(next);
        return next;
      });
    },
    [persistArchivedIds]
  );

  const handleDelete = useCallback(async (id: number) => {
    haptics.light();
    logNotificationDebug('delete: starting', { id });
    swipeableRefs.current.get(id)?.close();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        persistArchivedIds(next);
        return next;
      });
      logNotificationDebug('delete: success', { id });
    } catch (error) {
      logNotificationError('delete: failed', error);
    }
  }, [persistArchivedIds]);

  const handleNavigateToDetails = useCallback(
    (notification: Notification | UINotification) => {
      setPreviewNotification(null);

      const rawNotification = 'raw' in notification ? notification.raw : notification;
      logNotificationDebug('navigate: pressed notification', {
        id: rawNotification.id,
        type: rawNotification.type,
        status: rawNotification.status,
        requestId: rawNotification.requestId,
        providerId: rawNotification.providerId,
        quotationId: rawNotification.quotationId,
        transactionId: rawNotification.transactionId,
        userRole,
      });

      const route = resolveNotificationRoute(rawNotification, userRole);
      if (route) {
        router.push({
          pathname: route.pathname as any,
          params: route.params,
        } as any);
        return;
      }

      const uiNotif = 'raw' in notification ? notification : mapNotificationToUI(rawNotification);
      setPreviewNotification(uiNotif);
    },
    [router, userRole]
  );

  const previewRoute = useMemo(
    () =>
      previewNotification
        ? resolveNotificationRoute(previewNotification.raw, userRole)
        : null,
    [previewNotification, userRole]
  );

  const notificationSections = useMemo<NotificationSection[]>(
    () =>
      (['Recent', 'Yesterday', 'Last week'] as const)
        .map((title) => ({
          title,
          data: groupedNotifications[title] ?? [],
        }))
        .filter((section) => section.data.length > 0),
    [groupedNotifications]
  );

  const setSwipeableRef = useCallback((id: number, ref: Swipeable | null) => {
    if (ref) swipeableRefs.current.set(id, ref);
    else swipeableRefs.current.delete(id);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) => (
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-Bold',
          color: Colors.textSecondaryDark,
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {section.title}
      </Text>
    ),
    []
  );

  const renderNotification = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: UINotification;
      index: number;
      section: NotificationSection;
    }) => (
      <NotificationListItem
        notification={item}
        isLastInSection={index === section.data.length - 1}
        filterPill={filterPill}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={handleDelete}
        onMarkAsRead={handleMarkAsRead}
        onNavigate={handleNavigateToDetails}
        setSwipeableRef={setSwipeableRef}
      />
    ),
    [filterPill, handleArchive, handleDelete, handleNavigateToDetails, handleUnarchive, setSwipeableRef]
  );

  const listEmpty = useMemo(() => {
    if (isLoading && !hasNotifications) {
      return (
        <View style={{ marginBottom: 24 }}>
          {[1, 2, 3].map((i) => (
            <NotificationCardSkeleton key={i} />
          ))}
        </View>
      );
    }

    if (filteredNotifications.length === 0 && !isLoading) {
      return (
        <View
          style={{
            marginTop: 20,
            paddingVertical: 36,
            paddingHorizontal: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(17, 24, 39, 0.04)',
            backgroundColor: Colors.sageSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={28} color={Colors.textTertiary} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 15,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {filterPill === 'archive'
              ? 'No archived notifications'
              : filterPill === 'all' && archivedIds.size > 0
                ? 'No notifications to show'
                : filterPill === 'unread'
                  ? 'No unread notifications'
                  : filterPill === 'read'
                    ? 'No read notifications'
                    : 'No notifications'}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: 18,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
            }}
          >
            Try another filter or check back after new job activity.
          </Text>
        </View>
      );
    }

    return null;
  }, [archivedIds.size, filterPill, filteredNotifications.length, hasNotifications, isLoading]);

  if (!isLoading && !hasNotifications) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.white}>
        <View style={{ flex: 1 }}>
          <ScreenHeader title="Notifications" onBack={() => router.back()} />
          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 28,
                backgroundColor: Colors.sageTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}
            >
              <Bell size={30} color={Colors.accent} />
            </View>
            <Text
              style={{
                fontSize: 19,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              No notifications yet
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 20,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              Booking updates, payments, messages, and job activity will appear here.
            </Text>
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Notifications"
          onBack={() => router.back()}
          style={{ paddingBottom: 10 }}
          rightElement={
            <TouchableOpacity
              onPress={handleClearAll}
              activeOpacity={0.7}
              disabled={!hasNotifications || isClearing}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
              accessibilityLabel="Clear all notifications"
              accessibilityHint="Deletes all notifications"
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: hasNotifications && !isClearing ? Colors.accent : Colors.textTertiary,
                }}
              >
                {isClearing ? 'Clearing' : 'Clear'}
              </Text>
            </TouchableOpacity>
          }
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <View
            style={{
              backgroundColor: Colors.surfaceDark,
              borderRadius: 24,
              padding: 18,
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -36,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: Colors.accent,
                opacity: 0.18,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Bell size={21} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.white,
                  }}
                >
                  Stay updated
                </Text>
                <Text
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    lineHeight: 18,
                    fontFamily: 'Poppins-Regular',
                    color: 'rgba(255,255,255,0.74)',
                  }}
                >
                  {unreadCount > 0
                    ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'} need your attention.`
                    : 'You are all caught up.'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 40,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 0,
              minHeight: 36,
            }}
          >
            {(['all', 'unread', 'read', 'archive'] as FilterPill[]).map((pill, index) => {
              const isActive = filterPill === pill;
              return (
                <TouchableOpacity
                  key={pill}
                  onPress={() => {
                    haptics.light();
                    setFilterPill(pill);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={getFilterLabel(pill)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    minHeight: MIN_TOUCH_TARGET,
                    justifyContent: 'center',
                    borderRadius: 999,
                    backgroundColor: isActive ? Colors.accent : Colors.backgroundGray,
                    borderWidth: isActive ? 0 : 1,
                    borderColor: Colors.border,
                    marginRight: index < 3 ? 8 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-SemiBold',
                      color: isActive ? Colors.white : Colors.textSecondaryDark,
                      textTransform: 'capitalize',
                      lineHeight: 14,
                    }}
                  >
                    {getFilterLabel(pill)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <SectionList
          sections={notificationSections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={() => <View style={{ height: 26 }} />}
          ListEmptyComponent={listEmpty}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 100,
            flexGrow: 1,
          }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />


        {/* Preview Modal */}
        <Modal
          visible={!!previewNotification}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewNotification(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
          >
            {previewNotification && (
              <View
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  padding: 22,
                  width: '100%',
                  maxWidth: 400,
                  borderWidth: 1,
                  borderColor: Colors.borderSage,
                  elevation: 0,
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        backgroundColor: previewNotification.iconBgColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      {previewNotification.icon && (
                        <previewNotification.icon
                          size={21}
                          color={previewNotification.iconColor}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: 'Poppins-Bold',
                          color: Colors.textPrimary,
                          marginBottom: 4,
                        }}
                      >
                        {previewNotification.type}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Regular',
                          color: Colors.textSecondaryDark,
                          lineHeight: 17,
                        }}
                      >
                        {previewNotification.time}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setPreviewNotification(null)}
                    style={{
                      width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                    accessibilityLabel="Close preview"
                  >
                    <X size={20} color={Colors.textSecondaryDark} />
                  </TouchableOpacity>
                </View>

                {/* Description */}
                {!!previewNotification.description && (
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      marginBottom: 24,
                      lineHeight: 21,
                    }}
                  >
                    {previewNotification.description}
                  </Text>
                )}

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setPreviewNotification(null)}
                    style={{
                      flex: 1,
                      backgroundColor: Colors.backgroundGray,
                      borderRadius: 14,
                      paddingVertical: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: 'Poppins-SemiBold',
                        color: Colors.textPrimary,
                      }}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                  {previewRoute ? (
                    <TouchableOpacity
                      onPress={() => handleNavigateToDetails(previewNotification)}
                      style={{
                        flex: 1,
                        backgroundColor: Colors.accent,
                        borderRadius: 14,
                        paddingVertical: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: 'Poppins-SemiBold',
                          color: Colors.white,
                        }}
                      >
                        {notificationActionLabel(previewRoute)}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}
