import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import ChatDateSeparator from '@/components/chat/ChatDateSeparator';
import ChatMessageRow from '@/components/chat/ChatMessageRow';
import ChatNewMessagesChip from '@/components/chat/ChatNewMessagesChip';
import ChatTypingBubble from '@/components/chat/ChatTypingBubble';
import { BorderRadius, Colors, Spacing, SHADOWS, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { androidElevation, iosOnlyShadow } from '@/lib/surfaceStyles';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, AlertCircle, FileText, Phone, Send, User, MoreVertical } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  Alert,
  Image,
  Keyboard,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { useChatTypingIndicator } from '@/hooks/useChatTypingIndicator';
import { LinearGradient } from 'expo-linear-gradient';
import {
  providerService,
  communicationService,
  authService,
  serviceRequestService,
  Message as ApiMessage,
} from '@/services/api';
import { joinSubtitleParts } from '@/utils/copy';
import { logChatDebug } from '@/utils/chatDebugLog';
import { buildChatListItems } from '@/utils/chatListItems';
import { formatLastActiveLabel, isPeerRecentlyActive } from '@/utils/chatFormatting';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DirectionHint = 'outgoing' | 'incoming' | null;

/**
 * Pull sender id from common API shapes (flat + nested). List endpoint often omits top-level senderId.
 */
function extractSenderFieldsFromApiMessage(m: Record<string, unknown>): {
  senderIdRaw: unknown;
  senderIdNum: number;
  directionFromApi: DirectionHint;
} {
  const raw = m as Record<string, unknown>;
  const candidates: unknown[] = [
    raw.senderId,
    raw.sender_id,
    raw.senderUserId,
    raw.fromUserId,
    raw.authorId,
    typeof raw.sender === 'object' && raw.sender !== null
      ? (raw.sender as Record<string, unknown>).id
      : undefined,
    typeof raw.sender === 'object' && raw.sender !== null
      ? (raw.sender as Record<string, unknown>).userId
      : undefined,
    typeof raw.user === 'object' && raw.user !== null ? (raw.user as Record<string, unknown>).id : undefined,
    typeof raw.from === 'object' && raw.from !== null ? (raw.from as Record<string, unknown>).id : undefined,
    typeof raw.createdBy === 'object' && raw.createdBy !== null
      ? (raw.createdBy as Record<string, unknown>).id
      : undefined,
    raw.createdById,
  ];

  let senderIdRaw: unknown = null;
  let senderIdNum = NaN;
  for (const c of candidates) {
    if (c != null && c !== '') {
      const n = Number(c);
      if (!Number.isNaN(n)) {
        senderIdRaw = c;
        senderIdNum = n;
        break;
      }
    }
  }

  let directionFromApi: DirectionHint = null;
  const dir = raw.direction ?? raw.messageDirection;
  if (typeof dir === 'string') {
    const d = dir.toLowerCase();
    if (d === 'outgoing' || d === 'outbound' || d === 'sent') directionFromApi = 'outgoing';
    else if (d === 'incoming' || d === 'inbound' || d === 'received') directionFromApi = 'incoming';
  }
  if (raw.isOutgoing === true) directionFromApi = 'outgoing';
  if (raw.isIncoming === true) directionFromApi = 'incoming';

  return { senderIdRaw, senderIdNum, directionFromApi };
}

/**
 * UI Message interface - adapted from API message for display
 */
interface UIMessage {
  id: string;
  text: string;
  sender: 'user' | 'provider';
  timestamp: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isRead?: boolean;
  isFromCurrentUser?: boolean; // Whether this message is from the current user
}

/**
 * ChatScreen Component
 * 
 * Real-time messaging interface for service requests.
 * Works for both users and providers - automatically detects from route params.
 * 
 * Features:
 * - Load messages from API
 * - Send messages via API
 * - Auto-refresh messages every 2s while focused, 5s when backgrounded
 * - Mark messages as read when viewing
 * - Show unread count
 * - Pull-to-refresh
 * 
 * Route Params:
 * - requestId: Service request ID (required)
 * - providerName: Provider name (for user view)
 * - providerId: Provider ID (optional)
 * - clientName: Client name (for provider view)
 */
export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError, showSuccess } = useToast();
  const params = useLocalSearchParams<{ 
    providerName?: string; 
    providerId?: string; 
    clientName?: string;
    requestId?: string;
  }>();

  // Extract and validate requestId
  const requestId = params.requestId ? parseInt(params.requestId, 10) : null;
  const isValidRequestId = requestId !== null && !isNaN(requestId);

  // UI State
  const providerName = params.providerName || 'Service Provider';
  const clientName = params.clientName || 'Client';
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasQuotation, setHasQuotation] = useState<boolean>(false);
  const [isCheckingQuotation, setIsCheckingQuotation] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isSyncDegraded, setIsSyncDegraded] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [deletedMessageIds, setDeletedMessageIds] = useState<string[]>([]);
  /** When route has no providerId (e.g. opened from notification), filled from request details */
  const [resolvedProviderId, setResolvedProviderId] = useState<number | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [footerHeight, setFooterHeight] = useState(76);
  const [pendingNewCount, setPendingNewCount] = useState(0);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMarkingAsReadRef = useRef(false);
  const ownershipByMessageIdRef = useRef<Record<string, boolean>>({});
  const stableCurrentUserIdRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const { isPeerTyping } = useChatTypingIndicator(requestId);

  // Determine if this is provider view (has clientName) or user view
  const isProviderView = !!params.clientName;
  const chatCacheKey = isValidRequestId ? `@ghands:chat_messages:${requestId}` : null;
  const deletedIdsKey = isValidRequestId ? `@ghands:chat_deleted_ids:${requestId}` : null;
  const providerIdNum = params.providerId ? Number(params.providerId) : null;
  const peerName = isProviderView ? clientName : providerName;

  const chatListItems = useMemo(() => buildChatListItems(messages), [messages]);

  const peerLastActiveAt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.isFromCurrentUser) return m.timestamp;
    }
    return null;
  }, [messages]);

  const lastActiveLabel = formatLastActiveLabel(peerLastActiveAt);
  const showActiveDot = isPeerRecentlyActive(peerLastActiveAt);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distanceFromBottom < 96;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setPendingNewCount(0);
    }
  }, []);

  const handleJumpToNewMessages = useCallback(() => {
    setPendingNewCount(0);
    isNearBottomRef.current = true;
    scrollToBottom(true);
  }, [scrollToBottom]);

  useEffect(() => {
    setResolvedProviderId(null);
  }, [requestId, params.providerId]);

  const loadCachedMessages = useCallback(async (): Promise<UIMessage[] | null> => {
    if (!chatCacheKey) return null;
    try {
      const raw = await AsyncStorage.getItem(chatCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as UIMessage[]) : null;
    } catch {
      return null;
    }
  }, [chatCacheKey]);

  const persistMessagesCache = useCallback(
    async (nextMessages: UIMessage[]) => {
      if (!chatCacheKey || !Array.isArray(nextMessages) || nextMessages.length === 0) return;
      try {
        await AsyncStorage.setItem(chatCacheKey, JSON.stringify(nextMessages));
      } catch {
        // Non-fatal cache failure
      }
    },
    [chatCacheKey]
  );

  const loadDeletedMessageIds = useCallback(async (): Promise<string[]> => {
    if (!deletedIdsKey) return [];
    try {
      const raw = await AsyncStorage.getItem(deletedIdsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }, [deletedIdsKey]);

  const persistDeletedMessageIds = useCallback(
    async (ids: string[]) => {
      if (!deletedIdsKey) return;
      try {
        await AsyncStorage.setItem(deletedIdsKey, JSON.stringify(ids));
      } catch {
        // Non-fatal
      }
    },
    [deletedIdsKey]
  );

  /**
   * Format date to time string (e.g., "2:30pm")
   */
  const formatTime = useCallback((dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const period = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
    } catch {
      return '';
    }
  }, []);

  /**
   * Convert API message to UI message format
   * Standard layout: my messages = right, received = left
   *
   * Ownership must use senderId vs known party ids — backend often omits/wrong senderType,
   * which previously marked all bubbles as "provider" (left) after refresh.
   */
  const mapApiMessageToUI = useCallback(
    (
      apiMessage: ApiMessage,
      currentUserId: number | null,
      peerProviderOverride?: number | null
    ): UIMessage => {
      const rawSenderType = ((apiMessage as any).senderType || (apiMessage as any).sender_type || '')
        .toString()
        .toLowerCase();

      const ex = extractSenderFieldsFromApiMessage(apiMessage as unknown as Record<string, unknown>);
      const senderIdRaw = ex.senderIdRaw;
      const senderIdNum = ex.senderIdNum;
      const directionFromApi = ex.directionFromApi;
      const currentUserIdNum = currentUserId != null ? Number(currentUserId) : null;

      const messageId = String((apiMessage as any).id ?? '');

      const isFromClientType =
        rawSenderType === 'user' || rawSenderType === 'client' || rawSenderType === 'customer';
      const isFromProviderType =
        rawSenderType === 'provider' || rawSenderType === 'company';

      const peerProviderId =
        peerProviderOverride !== undefined ? peerProviderOverride : providerIdNum ?? resolvedProviderId;

      let isFromCurrentUser = false;
      let ownershipBranch:
        | 'identity'
        | 'peerProvider'
        | 'direction'
        | 'ownershipRef'
        | 'senderTypeFallback' = 'senderTypeFallback';

      // 1) Same id as logged-in party (user id or company id) — works when JWT/storage matches API
      if (
        currentUserIdNum !== null &&
        Number.isFinite(senderIdNum) &&
        !Number.isNaN(senderIdNum)
      ) {
        isFromCurrentUser = senderIdNum === currentUserIdNum;
        ownershipBranch = 'identity';
      }
      // 2) Client app + we know provider id: only that id is the other party (handles missing/wrong senderType)
      else if (
        !isProviderView &&
        peerProviderId !== null &&
        Number.isFinite(peerProviderId) &&
        Number.isFinite(senderIdNum) &&
        !Number.isNaN(senderIdNum)
      ) {
        isFromCurrentUser = senderIdNum !== peerProviderId;
        ownershipBranch = 'peerProvider';
      }
      // 3) API direction (outgoing = mine, incoming = theirs) when sender id is missing
      else if (directionFromApi === 'outgoing') {
        isFromCurrentUser = true;
        ownershipBranch = 'direction';
      } else if (directionFromApi === 'incoming') {
        isFromCurrentUser = false;
        ownershipBranch = 'direction';
      }
      // 4) Last known per message (optimistic send)
      else if (messageId && ownershipByMessageIdRef.current[messageId] !== undefined) {
        isFromCurrentUser = ownershipByMessageIdRef.current[messageId];
        ownershipBranch = 'ownershipRef';
      }
      // 5) senderType only (often wrong/empty from API)
      else {
        isFromCurrentUser = isProviderView ? isFromProviderType : isFromClientType;
        ownershipBranch = 'senderTypeFallback';
      }

      if (__DEV__) {
        logChatDebug('message map', {
          id: messageId,
          senderIdRaw: senderIdRaw ?? null,
          senderIdNum: Number.isNaN(senderIdNum) ? 'NaN' : senderIdNum,
          senderType: rawSenderType || '(empty)',
          directionFromApi: directionFromApi ?? '(none)',
          currentUserId: currentUserIdNum,
          peerProviderId: peerProviderId ?? null,
          branch: ownershipBranch,
          isFromCurrentUser,
        });
      }

      const sender: 'user' | 'provider' = isProviderView
        ? isFromCurrentUser
          ? 'provider'
          : 'user'
        : isFromCurrentUser
          ? 'user'
          : 'provider';

      if (messageId) {
        ownershipByMessageIdRef.current[messageId] = isFromCurrentUser;
      }

      const rawContent = (apiMessage as any).content ?? (apiMessage as any).body ?? (apiMessage as any).text ?? '';
      const safeText = (rawContent == null || String(rawContent).toLowerCase() === 'null') ? '' : String(rawContent);
      const createdAt = apiMessage.createdAt || apiMessage.updatedAt || new Date().toISOString();

      return {
        id: String(apiMessage.id),
        text: safeText,
        sender,
        timestamp: createdAt,
        time: formatTime(createdAt),
        status: isFromCurrentUser
          ? apiMessage.isRead || apiMessage.readAt
            ? 'read'
            : 'delivered'
          : undefined,
        isRead: apiMessage.isRead || !!apiMessage.readAt,
        isFromCurrentUser, // Store this for alignment logic
      };
    },
    [formatTime, isProviderView, providerIdNum, resolvedProviderId]
  );

  /**
   * Load messages from API
   */
  const loadMessages = useCallback(async (showLoading = true) => {
    if (!isValidRequestId) {
      setIsLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(true);
        const cached = await loadCachedMessages();
        if (cached && cached.length > 0) {
          cached.forEach((m) => animatedMessageIdsRef.current.add(m.id));
          setMessages(cached);
        }
      }

      const result = await communicationService.getMessages(requestId!, {
        limit: 50,
        offset: 0,
      });

      // Get current user ID to determine message sender
      let userId: number | null = stableCurrentUserIdRef.current;
      try {
        const fetchedUserId = isProviderView
          ? await authService.getCompanyId()
          : await authService.getUserId();
        if (fetchedUserId != null && !isNaN(Number(fetchedUserId))) {
          userId = Number(fetchedUserId);
          stableCurrentUserIdRef.current = userId;
          setCurrentUserId(userId);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error getting user ID:', error);
        }
      }

      let peerProviderForThread: number | null = providerIdNum ?? resolvedProviderId;
      if (!isProviderView && peerProviderForThread === null && requestId) {
        try {
          const details = await serviceRequestService.getRequestDetails(requestId);
          const sp = details.selectedProvider?.id;
          if (sp != null) {
            peerProviderForThread = Number(sp);
            setResolvedProviderId(peerProviderForThread);
          }
        } catch {
          /* non-fatal — alignment falls back to senderType */
        }
      }

      const uniqueSenderIds = Array.from(
        new Set(
          result.messages.map((m) => {
            const ex = extractSenderFieldsFromApiMessage(m as unknown as Record<string, unknown>);
            return ex.senderIdRaw != null && ex.senderIdRaw !== '' ? String(ex.senderIdRaw) : '—';
          })
        )
      );
      if (result.messages.length > 0) {
        const s0 = result.messages[0] as unknown as Record<string, unknown>;
        const ex0 = extractSenderFieldsFromApiMessage(s0);
        logChatDebug('GET messages sample (first row)', {
          endpoint: `GET /api/communication/requests/${requestId}/messages`,
          topLevelKeys: Object.keys(s0),
          extractedSenderId: ex0.senderIdRaw,
          directionHint: ex0.directionFromApi,
        });
      }
      logChatDebug('loadMessages context', {
        requestId,
        isProviderView,
        routeProviderId: params.providerId ?? null,
        currentUserOrCompanyId: userId,
        peerProviderForThread: peerProviderForThread ?? null,
        messageCount: result.messages.length,
        uniqueSenderIdsInBatch: uniqueSenderIds,
      });

      // Convert API messages to UI format
      const uiMessages = result.messages.map((msg) =>
        mapApiMessageToUI(msg, userId, peerProviderForThread)
      );

      const mineCount = uiMessages.filter((m) => m.isFromCurrentUser).length;
      logChatDebug('loadMessages result', {
        requestId,
        mappedMine: mineCount,
        mappedTheirs: uiMessages.length - mineCount,
      });

      // Sort by timestamp (oldest first)
      uiMessages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Apply "delete for me" local filter
      const filteredMessages = deletedMessageIds.length
        ? uiMessages.filter((m) => !deletedMessageIds.includes(m.id))
        : uiMessages;

      // Don't overwrite with empty on background refresh – API may return bad/malformed data
      // and we'd wipe sent messages. Only overwrite if we got messages or this is initial load.
      setMessages((prev) => {
        if (filteredMessages.length > 0) return filteredMessages;
        if (prev.length > 0) return prev;
        return filteredMessages;
      });

      if (!initialLoadDoneRef.current) {
        filteredMessages.forEach((m) => animatedMessageIdsRef.current.add(m.id));
        initialLoadDoneRef.current = true;
      }

      if (filteredMessages.length > 0) {
        await persistMessagesCache(filteredMessages);
      }

      setIsSyncDegraded(false);
      setLastSyncError(null);

      // Scroll to bottom after loading if user was already near bottom
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading messages:', error);
      }
      // Keep existing messages on error
      const msg = (error as any)?.message ?? 'Unable to sync messages right now.';
      setIsSyncDegraded(true);
      setLastSyncError(String(msg));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    isValidRequestId,
    requestId,
    mapApiMessageToUI,
    loadCachedMessages,
    persistMessagesCache,
    isProviderView,
    deletedMessageIds,
    resolvedProviderId,
    providerIdNum,
    scrollToBottom,
  ]);

  useEffect(() => {
    (async () => {
      const ids = await loadDeletedMessageIds();
      setDeletedMessageIds(ids);
    })();
  }, [loadDeletedMessageIds]);

  const handleDeleteMessageForMe = useCallback(
    (msg: UIMessage) => {
      Alert.alert('Delete message?', 'This will remove the message from your view only.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const nextIds = Array.from(new Set([...deletedMessageIds, msg.id]));
            setDeletedMessageIds(nextIds);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            await persistDeletedMessageIds(nextIds);
          },
        },
      ]);
    },
    [deletedMessageIds, persistDeletedMessageIds]
  );

  const openJobFromChatMenu = useCallback(() => {
    setChatMenuOpen(false);
    if (!requestId) return;
    haptics.light();
    if (isProviderView) {
      router.push({
        pathname: '/ProviderJobDetailsScreen',
        params: { requestId: String(requestId) },
      } as any);
    } else {
      router.push({
        pathname: '/OngoingJobDetails',
        params: { requestId: String(requestId) },
      } as any);
    }
  }, [requestId, isProviderView, router]);

  const clearChatCacheForThread = useCallback(async () => {
    setChatMenuOpen(false);
    if (!chatCacheKey) return;
    haptics.light();
    try {
      await AsyncStorage.removeItem(chatCacheKey);
      setMessages([]);
      showSuccess('Local chat cache cleared');
      await loadMessages(true);
    } catch {
      showError('Could not clear cache');
    }
  }, [chatCacheKey, loadMessages, showSuccess, showError]);

  /**
   * Mark messages as read
   */
  const markMessagesAsRead = useCallback(async () => {
    if (!isValidRequestId || isMarkingAsReadRef.current) {
      return;
    }

    try {
      isMarkingAsReadRef.current = true;
      await communicationService.markMessagesAsRead(requestId!);
      
      // Update local message state to reflect read status
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          isRead: true,
          status: msg.status === 'delivered' ? 'read' : msg.status,
        }))
      );
      
      // Refresh unread count
      loadUnreadCount();
    } catch (error) {
      if (__DEV__) {
        console.error('Error marking messages as read:', error);
      }
    } finally {
      isMarkingAsReadRef.current = false;
    }
  }, [isValidRequestId, requestId]);

  /**
   * Load unread message count
   */
  const loadUnreadCount = useCallback(async () => {
    if (!isValidRequestId) {
      return;
    }

    try {
      const result = await communicationService.getUnreadCount(requestId!);
      setUnreadCount(result.count);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading unread count:', error);
      }
    }
  }, [isValidRequestId, requestId]);

  /**
   * Send a message
   */
  const handleSend = useCallback(async () => {
    if (!message.trim() || !isValidRequestId || isSending) {
      return;
    }

    const messageText = message.trim();
    setMessage('');
    setIsSending(true);

    // Optimistically add message to UI
    const optimisticMessage: UIMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      sender: isProviderView ? 'provider' : 'user',
      timestamp: new Date().toISOString(),
      time: formatTime(new Date().toISOString()),
      status: 'sending',
      isFromCurrentUser: true, // Optimistic messages are always from current user
    };
    ownershipByMessageIdRef.current[optimisticMessage.id] = true;

    setMessages((prev) => [...prev, optimisticMessage]);
    haptics.selection();

    // Scroll to bottom when sending
    setTimeout(() => scrollToBottom(true), 100);

    try {
      // Send message to API
      const sentMessage = await communicationService.sendMessage(requestId!, {
        content: messageText,
        type: 'text',
      });

      let actorId: number | null = stableCurrentUserIdRef.current;
      if (actorId == null || Number.isNaN(actorId)) {
        try {
          const raw = isProviderView ? await authService.getCompanyId() : await authService.getUserId();
          if (raw != null && !Number.isNaN(Number(raw))) {
            actorId = Number(raw);
            stableCurrentUserIdRef.current = actorId;
            setCurrentUserId(actorId);
          }
        } catch {
          /* ignore */
        }
      }

      let peerPid: number | null = providerIdNum ?? resolvedProviderId;
      if (!isProviderView && peerPid === null && requestId) {
        try {
          const details = await serviceRequestService.getRequestDetails(requestId);
          const sp = details.selectedProvider?.id;
          if (sp != null) {
            peerPid = Number(sp);
            setResolvedProviderId(peerPid);
          }
        } catch {
          /* ignore */
        }
      }

      const mapped = mapApiMessageToUI(sentMessage as ApiMessage, actorId, peerPid);
      const finalMsg: UIMessage = {
        ...mapped,
        isFromCurrentUser: true,
        sender: isProviderView ? 'provider' : 'user',
      };
      ownershipByMessageIdRef.current[String(sentMessage.id)] = true;

      // Replace optimistic message with server message — always show as "mine" (this device sent it)
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? finalMsg : msg))
      );

      // Don't refresh here – backend may not include the new message yet, causing it to disappear.
      // The 5s auto-refresh will pick up replies from the other party.
    } catch (error: any) {
      if (__DEV__) {
        console.error('Error sending message:', error);
      }
      // Keep message visible but mark as failed – don't remove (so it doesn't disappear)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id ? { ...msg, status: 'failed' as const } : msg
        )
      );
      const msg = (error?.message || '').toLowerCase();
      const isServerSide = msg.includes('foreign key') || msg.includes('receiverid');
      showError(isServerSide ? 'Message could not be sent. Please try again or contact support.' : 'Message failed to send. Tap to retry.');
    } finally {
      setIsSending(false);
    }
  }, [
    message,
    isValidRequestId,
    isSending,
    isProviderView,
    formatTime,
    mapApiMessageToUI,
    requestId,
    showError,
    providerIdNum,
    resolvedProviderId,
    scrollToBottom,
  ]);

  /**
   * Retry sending a failed message
   */
  const retryFailedMessage = useCallback(
    async (msg: UIMessage) => {
      if (msg.status !== 'failed' || !isValidRequestId || isSending) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' as const } : m))
      );
      try {
        const sentMessage = await communicationService.sendMessage(requestId!, {
          content: msg.text,
          type: 'text',
        });
        let actorId: number | null = stableCurrentUserIdRef.current;
        if (actorId == null || Number.isNaN(actorId)) {
          try {
            const raw = isProviderView ? await authService.getCompanyId() : await authService.getUserId();
            if (raw != null && !Number.isNaN(Number(raw))) {
              actorId = Number(raw);
              stableCurrentUserIdRef.current = actorId;
              setCurrentUserId(actorId);
            }
          } catch {
            /* ignore */
          }
        }
        let peerPid: number | null = providerIdNum ?? resolvedProviderId;
        if (!isProviderView && peerPid === null && requestId) {
          try {
            const d = await serviceRequestService.getRequestDetails(requestId);
            const sp = d.selectedProvider?.id;
            if (sp != null) {
              peerPid = Number(sp);
              setResolvedProviderId(peerPid);
            }
          } catch {
            /* ignore */
          }
        }
        const mapped = mapApiMessageToUI(sentMessage as ApiMessage, actorId, peerPid);
        const finalMsg: UIMessage = {
          ...mapped,
          isFromCurrentUser: true,
          sender: isProviderView ? 'provider' : 'user',
        };
        ownershipByMessageIdRef.current[String(sentMessage.id)] = true;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? finalMsg : m)));
      } catch (error: any) {
        if (__DEV__) console.error('Error retrying message:', error);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' as const } : m))
        );
        const errMsg = (error?.message || '').toLowerCase();
        const isServerSide = errMsg.includes('foreign key') || errMsg.includes('receiverid');
        showError(isServerSide ? 'Message could not be sent. Please try again or contact support.' : 'Message failed to send. Tap to retry.');
      }
    },
    [
      isValidRequestId,
      requestId,
      isSending,
      mapApiMessageToUI,
      showError,
      isProviderView,
      providerIdNum,
      resolvedProviderId,
    ]
  );

  /**
   * Check if quotation exists (for provider view)
   */
  const checkQuotation = useCallback(async () => {
    if (!isProviderView || !isValidRequestId) {
      return;
    }

    setIsCheckingQuotation(true);
    try {
      const quotation = await providerService.getQuotation(requestId!);
      setHasQuotation(!!(quotation && quotation.id));
    } catch (error: any) {
      // Quotation doesn't exist or error - that's OK
      setHasQuotation(false);
    } finally {
      setIsCheckingQuotation(false);
    }
  }, [isProviderView, isValidRequestId, requestId]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadMessages(false),
      loadUnreadCount(),
      checkQuotation(),
    ]);
  }, [loadMessages, loadUnreadCount, checkQuotation]);

  // Load messages and unread count on mount
  useEffect(() => {
    if (isValidRequestId) {
      loadMessages();
      loadUnreadCount();
      checkQuotation();
    }
  }, [isValidRequestId, loadMessages, loadUnreadCount, checkQuotation]);

  // Mark messages as read + poll faster while chat is focused
  useFocusEffect(
    useCallback(() => {
      if (!isValidRequestId) {
        return undefined;
      }

      markMessagesAsRead();
      loadUnreadCount();
      void loadMessages(false);

      refreshIntervalRef.current = setInterval(() => {
        loadMessages(false);
        loadUnreadCount();
      }, 2000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }, [isValidRequestId, markMessagesAsRead, loadUnreadCount, loadMessages])
  );

  // Scroll to bottom for new peer messages only when already near bottom
  useEffect(() => {
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    const newMessages = messages.slice(prevMessageCountRef.current);
    const incomingCount = newMessages.filter((m) => !m.isFromCurrentUser).length;

    if (incomingCount > 0) {
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        setPendingNewCount((count) => count + incomingCount);
      }
    } else if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom(true), 50);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      const insetFromBottom = Math.max(0, windowHeight - event.endCoordinates.screenY);
      setKeyboardInset(insetFromBottom);
      setTimeout(() => scrollToBottom(true), 50);
    };
    const onHide = () => setKeyboardInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  const renderChatItem = useCallback(
    ({ item }: { item: ReturnType<typeof buildChatListItems<UIMessage>>[number] }) => {
      if (item.kind === 'date') {
        return <ChatDateSeparator label={item.label} />;
      }

      const animateEnter = !animatedMessageIdsRef.current.has(item.message.id);
      animatedMessageIdsRef.current.add(item.message.id);

      return (
        <ChatMessageRow
          message={item.message}
          isFirstInGroup={item.isFirstInGroup}
          isLastInGroup={item.isLastInGroup}
          animateEnter={animateEnter}
          onRetry={
            item.message.status === 'failed' ? () => retryFailedMessage(item.message) : undefined
          }
          onLongPress={() => handleDeleteMessageForMe(item.message)}
        />
      );
    },
    [handleDeleteMessageForMe, retryFailedMessage]
  );

  // Show error if requestId is invalid
  if (!isValidRequestId) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.white}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <Text style={{ fontSize: 16, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm }}>
            Request ID not found
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center' }}>
            Please go back and try again.
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.white} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#EEF1E8',
            backgroundColor: Colors.white,
          }}
        >
          <TouchableOpacity 
            onPress={() => {
              haptics.light();
              router.back();
            }} 
            activeOpacity={0.7}
            style={{
              width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 19,
              backgroundColor: '#F6F8F1',
            }}
          >
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#F6F8F1',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(17, 24, 39, 0.045)',
              }}
            >
              <Image
                source={isProviderView ? require('../assets/images/userimg.jpg') : require('../assets/images/plumbericon2.png')}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                }}
                resizeMode="cover"
              />
              {showActiveDot ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 1,
                    bottom: 1,
                    width: 11,
                    height: 11,
                    borderRadius: 6,
                    backgroundColor: '#22C55E',
                    borderWidth: 2,
                    borderColor: Colors.white,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
          <Text
            style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
            }}
          >
            {peerName}
          </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontFamily: 'Poppins-Regular',
                  color: showActiveDot ? '#16A34A' : Colors.textSecondaryDark,
                  marginTop: 2,
                }}
              >
                {joinSubtitleParts([
                  lastActiveLabel,
                  unreadCount > 0 ? `${unreadCount} unread` : '',
                ])}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => {
                haptics.light();
                logCallDebug('ChatScreen: open CallScreen (outgoing)', {
                  requestId: params.requestId,
                  providerId: params.providerId,
                  isProviderView,
                  calleeLabel: isProviderView ? clientName : providerName,
                });
                router.push({
                  pathname: '/CallScreen',
                  params: {
                    callState: 'outgoing',
                    callerName: isProviderView ? clientName : providerName,
                    callerId: params.providerId,
                    requestId: params.requestId,
                    jobTitle: 'Service Request',
                    jobDescription: 'Ongoing service request',
                    orderNumber: '#WO-2024-1157',
                    scheduledDate: 'Oct 20, 2024',
                    scheduledTime: '2:00 PM',
                    location: 'Service Location',
                    jobStatus: 'In Progress',
                    isProvider: isProviderView ? 'true' : 'false',
                  },
                } as any);
              }} 
              activeOpacity={0.7}
              style={{
                width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 19,
                backgroundColor: Colors.sageTint,
              }}
            >
              <Phone size={19} color={Colors.accent} />
            </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              haptics.light();
              setChatMenuOpen(true);
            }} 
            activeOpacity={0.7}
              style={{
                width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 19,
                backgroundColor: '#F6F8F1',
              }}
            >
              <MoreVertical size={19} color={Colors.textPrimary} />
          </TouchableOpacity>
          </View>
        </View>

        {/* Messages Area */}
        {isSyncDegraded && (
          <View
            style={{
              backgroundColor: '#FFFBEB',
              borderBottomWidth: 1,
              borderBottomColor: '#FDE68A',
              paddingHorizontal: Spacing.lg,
              paddingVertical: 9,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={14} color={Colors.warningForeground} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Medium',
                color: Colors.warningForeground,
                flex: 1,
              }}
              numberOfLines={2}
            >
              Reconnecting messages.{lastSyncError ? ' Showing last saved chat.' : ''}
            </Text>
          </View>
        )}

        {isLoading && messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F8F5', paddingHorizontal: 28 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: Colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(17, 24, 39, 0.045)',
                marginBottom: 14,
              }}
            >
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, marginBottom: 4 }}>
              Loading conversation
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center', lineHeight: 20 }}>
              Getting the latest messages for this service request.
            </Text>
          </View>
        ) : (
        <>
        <FlatList
          ref={flatListRef}
          data={chatListItems}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
            contentContainerStyle={{ 
              flexGrow: 1,
              paddingTop: 10,
              paddingBottom: footerHeight + 10,
            }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
            style={{ flex: 1, backgroundColor: '#F7F8F5' }}
            ListFooterComponent={
              isPeerTyping ? <ChatTypingBubble isProviderView={isProviderView} /> : null
            }
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 28,
                  paddingBottom: 60,
                }}
              >
                <View
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 41,
                    backgroundColor: Colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(17, 24, 39, 0.045)',
                    marginBottom: 16,
                  }}
                >
                  <User size={30} color={Colors.accent} />
                </View>
                <Text style={{ fontSize: 17, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' }}>
                  Start the conversation
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, lineHeight: 20, textAlign: 'center' }}>
                  Message {peerName} about timing, access details, materials, or anything needed for this job.
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.accent}
                colors={[Colors.accent]}
              />
            }
          />
        <ChatNewMessagesChip
          count={pendingNewCount}
          onPress={handleJumpToNewMessages}
          bottomOffset={footerHeight + keyboardInset}
        />
        </>
        )}

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: keyboardInset,
          }}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== footerHeight) {
              setFooterHeight(nextHeight);
            }
          }}
        >
        {/* Send Quotation Button - Only show for providers if quotation hasn't been sent yet */}
        {isProviderView && !hasQuotation && !isCheckingQuotation && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 8, backgroundColor: '#F7F8F5' }}>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                router.push({
                  pathname: '/SendQuotationScreen' as any,
                  params: {
                    requestId: params.requestId,
                  },
                });
              }}
              style={{
                backgroundColor: Colors.white,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#DCE8C9',
                paddingVertical: 11,
                paddingHorizontal: 13,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...iosOnlyShadow({
                  shadowColor: Colors.surfaceDark,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                }),
                elevation: androidElevation(0),
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: Colors.sageTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <FileText size={17} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                    }}
                  >
                    Send quotation
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    Share pricing without leaving the chat flow
                  </Text>
                </View>
              </View>
              <Send size={16} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Field */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: keyboardInset > 0 ? 6 : Math.max(insets.bottom, 8),
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#EEF1E8',
            backgroundColor: Colors.white,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F7F8F5',
              borderRadius: 26,
              borderWidth: 1,
              borderColor: '#E1E8D6',
              paddingHorizontal: 12,
              paddingVertical: 6,
              minHeight: 52,
            }}
          >
            <TextInput
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              style={{
                flex: 1,
                fontSize: 15,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                paddingVertical: Platform.OS === 'ios' ? 8 : 6,
                paddingHorizontal: 4,
                maxHeight: 100,
              }}
              placeholderTextColor={Colors.placeholder}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isSending}
            />
            
            {message.trim() && !isSending ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSend}
              >
                <LinearGradient
                  colors={[Colors.accent, '#5D8700']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 4,
                  }}
                >
                  <Send size={18} color={Colors.white} />
                </LinearGradient>
              </TouchableOpacity>
            ) : isSending ? (
              <View
                style={{
                  width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                }}
              >
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : null}
          </View>
        </View>
        </View>

        <Modal
          visible={chatMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setChatMenuOpen(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'flex-end',
            }}
            onPress={() => setChatMenuOpen(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: Colors.white,
                borderTopLeftRadius: BorderRadius.xl,
                borderTopRightRadius: BorderRadius.xl,
                paddingBottom: Spacing.xxl,
                paddingTop: Spacing.md,
                ...SHADOWS.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: Colors.border,
                  alignSelf: 'center',
                  marginBottom: Spacing.lg,
                }}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  paddingHorizontal: Spacing.lg,
                  marginBottom: Spacing.md,
                }}
              >
                Chat options
              </Text>
              <TouchableOpacity
                onPress={openJobFromChatMenu}
                style={{
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.lg,
                }}
              >
                <Text style={{ fontSize: 16, fontFamily: 'Poppins-Medium', color: Colors.textPrimary }}>
                  View job details
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 4 }}>
                  Open the full request timeline for this chat
                </Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm }} />
              <TouchableOpacity
                onPress={clearChatCacheForThread}
                style={{
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.lg,
                }}
              >
                <Text style={{ fontSize: 16, fontFamily: 'Poppins-Medium', color: Colors.textPrimary }}>
                  Clear local chat cache
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 4 }}>
                  Removes saved messages on this device only; they reload from the server
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChatMenuOpen(false)}
                style={{
                  marginTop: Spacing.md,
                  paddingVertical: Spacing.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>Close</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}
