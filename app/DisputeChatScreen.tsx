import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import ChatMessageRow from '@/components/chat/ChatMessageRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';
import { authService, disputeService, type DisputeMessage } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

/**
 * There is no socket connection anywhere in this app yet (chat, calls -
 * everything live is REST polling), so this follows the same pattern
 * rather than being the one screen that introduces a new dependency for it.
 * The backend's own docs call REST the source of truth and the socket event
 * a top-up, so polling alone is a complete, honest v1.
 */
const POLL_INTERVAL_MS = 4000;

function formatTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

export default function DisputeChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ disputeId?: string; caseId?: string }>();
  const disputeId = Number(params.disputeId);
  const isValidDisputeId = Number.isFinite(disputeId) && disputeId > 0;
  const { toast, showError, hideToast } = useToast();
  const keyboardOffset = useKeyboardAvoidingOffset();
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserIdRef = useRef<number | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadMessages = useCallback(
    async (showSpinner: boolean) => {
      if (!isValidDisputeId) return;
      try {
        const rows = await disputeService.getMessages(disputeId);
        rows.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        setMessages(rows);
      } catch (error: any) {
        if (showSpinner) showError(getSpecificErrorMessage(error, 'get_dispute_messages'));
      } finally {
        if (showSpinner) setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [disputeId, isValidDisputeId, showError],
  );

  useEffect(() => {
    authService.getUserId().then((id) => {
      currentUserIdRef.current = id;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isValidDisputeId) return undefined;
      void loadMessages(!hasLoadedOnceRef.current);
      pollRef.current = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [isValidDisputeId, loadMessages]),
  );

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending || !isValidDisputeId) return;

    setDraft('');
    setIsSending(true);
    haptics.light();
    try {
      const sent = await disputeService.sendMessage(disputeId, text);
      setMessages((current) => [...current, sent]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error: any) {
      setDraft(text);
      haptics.error();
      showError(getSpecificErrorMessage(error, 'send_dispute_message'));
    } finally {
      setIsSending(false);
    }
  };

  const caseLabel = typeof params.caseId === 'string' && params.caseId.trim() ? params.caseId.trim() : null;

  if (!isValidDisputeId) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.white}>
        <ScreenHeader
          title="Support chat"
          onBack={() => navigateBack(router, NAV_FALLBACK.clientJobs)}
          backgroundColor={Colors.white}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center' }}>
            This case could not be found.
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScreenHeader
          title={caseLabel ? `Case ${caseLabel}` : 'Support chat'}
          onBack={() => navigateBack(router, NAV_FALLBACK.clientJobs)}
          backgroundColor={Colors.white}
          showBottomBorder
        />

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={Colors.textSecondaryDark} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => {
              const isMine = item.senderType === 'user' && item.senderId === currentUserIdRef.current;
              const prev = messages[index - 1];
              const next = messages[index + 1];
              const isFirstInGroup = !prev || prev.senderType !== item.senderType || prev.senderId !== item.senderId;
              const isLastInGroup = !next || next.senderType !== item.senderType || next.senderId !== item.senderId;
              return (
                <ChatMessageRow
                  message={{
                    id: String(item.id),
                    text: item.message,
                    sender: isMine ? 'user' : 'provider',
                    time: formatTime(item.createdAt),
                    isFromCurrentUser: isMine,
                  }}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  animateEnter={false}
                  counterpartName="Support"
                />
              );
            }}
            contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    textAlign: 'center',
                    lineHeight: 20,
                  }}
                >
                  Your report has been sent to our support team. Send a message here if you have anything to add.
                </Text>
              </View>
            }
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.white,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor={Colors.placeholder}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textPrimary,
              maxHeight: 100,
              marginRight: 10,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!draft.trim() || isSending}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !draft.trim() || isSending ? 0.5 : 1,
            }}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Send size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}
