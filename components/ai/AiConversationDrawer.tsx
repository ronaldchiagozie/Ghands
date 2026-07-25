import {
  AI_ANIMATION,
  AI_DRAWER,
} from '@/components/ai/aiAssistantTheme';
import { haptics } from '@/hooks/useHaptics';
import type { AiConversationSummary } from '@/services/api';
import { applyHandyAiStatusBar } from '@/utils/statusBar';
import { MessageSquare, Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AiConversationDrawerProps = {
  visible: boolean;
  conversations: AiConversationSummary[];
  activeConversationId: number | null;
  isLoading: boolean;
  botName: string;
  userName?: string;
  userEmail?: string;
  onClose: () => void;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onDelete: (id: number) => void;
};

function formatConversationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DrawerHeader({
  userEmail,
  botName,
}: {
  userEmail?: string;
  botName: string;
}) {
  const subtitle = userEmail?.trim() || `Chat with ${botName}`;

  return (
    <View style={styles.headerBlock}>
      <Text style={styles.headerEyebrow}>CONVERSATIONS</Text>
      <Text style={styles.headerTitle}>Your chats</Text>
      <Text style={styles.headerSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

function ConversationRow({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: AiConversationSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      onLongPress={onDelete}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation: ${conversation.title}`}
      accessibilityHint="Long press to delete"
      style={({ pressed }) => [
        styles.menuRow,
        isActive && styles.menuRowActive,
        pressed && styles.menuRowPressed,
      ]}
    >
      <View style={styles.menuRowInner}>
        <View style={styles.menuIconWrap}>
          <MessageSquare
            size={20}
            color={isActive ? AI_DRAWER.accent : AI_DRAWER.icon}
            strokeWidth={2}
          />
        </View>
        <Text
          numberOfLines={1}
          style={[styles.menuLabel, isActive && styles.menuLabelActive]}
        >
          {conversation.title}
        </Text>
        <Text style={styles.menuMeta}>{formatConversationDate(conversation.updatedAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function AiConversationDrawer({
  visible,
  conversations,
  activeConversationId,
  isLoading,
  botName,
  userEmail,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
}: AiConversationDrawerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.min(Math.round(windowWidth * 0.92), 420);

  const [modalVisible, setModalVisible] = useState(visible);
  const slideProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const slideAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const modalVisibleRef = useRef(modalVisible);
  modalVisibleRef.current = modalVisible;

  const panelTranslateX = useMemo(
    () =>
      slideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-panelWidth, 0],
      }),
    [panelWidth, slideProgress]
  );

  const overlayOpacity = useMemo(
    () =>
      slideProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [slideProgress]
  );

  useEffect(() => {
    slideAnimation.current?.stop();

    if (visible) {
      setModalVisible(true);
      slideProgress.setValue(0);
      slideAnimation.current = Animated.timing(slideProgress, {
        toValue: 1,
        duration: AI_ANIMATION.drawerSlideMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      slideAnimation.current.start();
      return;
    }

    if (!modalVisibleRef.current) return;

    slideAnimation.current = Animated.timing(slideProgress, {
      toValue: 0,
      duration: AI_ANIMATION.drawerSlideMs,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    slideAnimation.current.start(({ finished }) => {
      if (finished) setModalVisible(false);
    });
  }, [slideProgress, visible]);

  useEffect(() => {
    if (!modalVisible) {
      applyHandyAiStatusBar();
    }
  }, [modalVisible]);

  const handleDelete = (conversation: AiConversationSummary) => {
    haptics.light();
    Alert.alert(
      'Delete conversation',
      'This chat will be removed permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(conversation.id),
        },
      ]
    );
  };

  const displayBot = botName.trim() || 'Handy';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.shell} pointerEvents="box-none">
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          pointerEvents={modalVisible ? 'auto' : 'none'}
          style={[
            styles.panel,
            {
              width: panelWidth,
              transform: [{ translateX: panelTranslateX }],
              paddingTop: insets.top + 20,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <DrawerHeader userEmail={userEmail} botName={displayBot} />

          <View style={styles.divider} />

          <View style={styles.listWrap}>
            {isLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="small" color={AI_DRAWER.muted} />
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.centerState}>
                <Text style={styles.emptyText}>
                  No chats yet. Start a new conversation below.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.listScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              >
                {conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    onSelect={() => {
                      haptics.light();
                      onSelect(conversation.id);
                    }}
                    onDelete={() => handleDelete(conversation)}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.footerWrap}>
            <Pressable
              onPress={() => {
                haptics.light();
                onNewChat();
              }}
              accessibilityRole="button"
              accessibilityLabel="Start new chat"
              style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
            >
              <View style={styles.footerBtnInner}>
                <Plus size={18} color={AI_DRAWER.footerBtnText} strokeWidth={2.4} />
                <Text style={styles.footerBtnText}>New chat</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AI_DRAWER.overlay,
    zIndex: 1,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    backgroundColor: AI_DRAWER.background,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 24,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 8, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 20 },
    }),
  },
  headerBlock: {
    flexShrink: 0,
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  headerEyebrow: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    color: AI_DRAWER.muted,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    letterSpacing: -0.2,
    color: AI_DRAWER.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: AI_DRAWER.textSecondary,
    maxWidth: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AI_DRAWER.divider,
    marginTop: 16,
    marginBottom: 8,
    flexShrink: 0,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  menuRow: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginBottom: 14,
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  menuRowActive: {
    backgroundColor: AI_DRAWER.rowActive,
  },
  menuRowPressed: {
    opacity: 0.72,
  },
  menuIconWrap: {
    width: 28,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: AI_DRAWER.textPrimary,
    paddingRight: 8,
  },
  menuLabelActive: {
    fontFamily: 'Poppins-SemiBold',
    color: AI_DRAWER.accent,
  },
  menuMeta: {
    flexShrink: 0,
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: AI_DRAWER.muted,
    marginLeft: 4,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 8,
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: AI_DRAWER.textSecondary,
    textAlign: 'center',
  },
  footerWrap: {
    flexShrink: 0,
    paddingTop: 8,
  },
  footerBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: AI_DRAWER.footerBtnBg,
  },
  footerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerBtnPressed: {
    opacity: 0.88,
  },
  footerBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: AI_DRAWER.footerBtnText,
    marginLeft: 8,
  },
});
