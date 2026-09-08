import AiAssistantBackground from '@/components/ai/AiAssistantBackground';
import AiConversationDrawer from '@/components/ai/AiConversationDrawer';
import AiMenuButton from '@/components/ai/AiMenuButton';
import AiPromptInput from '@/components/ai/AiPromptInput';
import Toast from '@/components/Toast';
import AiQuickActionCarousel from '@/components/ai/AiQuickActionCarousel';
import AiBotUnavailableView from '@/components/ai/chat/AiBotUnavailableView';
import AiThinkingOrb from '@/components/ai/AiThinkingOrb';
import AiChatMessageList from '@/components/ai/chat/AiChatMessageList';
import type { AiSuggestion } from '@/components/ai/chat/types';
import {
  AI_ANIMATION,
  AI_COLORS,
  AI_ASSISTANT_TEXT,
  buildAiGreeting,
  type AiQuickAction,
} from '@/components/ai/aiAssistantTheme';
import { useAiChatSession } from '@/hooks/useAiChatSession';
import { useAiMascotAnimation } from '@/hooks/useAiMascotAnimation';
import { useCurrentUserProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';
import { useTypewriterText } from '@/hooks/useTypewriterText';
import { haptics } from '@/hooks/useHaptics';
import { MIN_TOUCH_TARGET, runParallel, useReducedMotion } from '@/lib/designSystem';
import { applyDefaultStatusBar, applyHandyAiStatusBar, HANDY_AI_STATUS_BAR_BACKGROUND } from '@/utils/statusBar';
import { startAiAssistedBooking } from '@/utils/aiBookingFlow';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearHandySession, readHandySession, rememberHandySession } from '@/utils/handySession';
import { ArrowLeft } from 'lucide-react-native';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';

const AI_BOT_HAPPY = require('../ghandsaibothappy.png');

export default function AiAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId?: string;
    newChat?: string;
  }>();
  const { toast, showError, showInfo, hideToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { animatedStyle: mascotAnimatedStyle, entranceComplete } = useAiMascotAnimation();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isStartingBooking, setIsStartingBooking] = useState(false);

  const session = useAiChatSession();
  const { data: userProfile } = useCurrentUserProfile();
  const {
    mode,
    messages,
    conversationId,
    botName,
    drawerVisible,
    conversations,
    isLoadingConversations,
    isLoadingHistory,
    isCheckingStatus,
    isBotTyping,
    suggestion,
    suggestionMessageId,
    suggestionVisible,
    imageUploadMessageId,
    imageSlotVisible,
    imagePromptItems,
    hiddenImageCount,
    showWelcomeHome,
    showChatLayout,
    sendMessage,
    applySuggestionDraft,
    addImagesFromPicker,
    onBotMessageRevealed,
    checkAvailability,
    loadConversation,
    startNewChat,
    openDrawer,
    closeDrawer,
    deleteConversation,
  } = session;

  const greeting = useMemo(() => buildAiGreeting(botName), [botName]);
  const { textWithCursor } = useTypewriterText(greeting, AI_ANIMATION.typewriterCharMs, {
    active: entranceComplete && !isCheckingStatus,
  });

  const homeOpacity = useRef(new Animated.Value(1)).current;
  const homeTranslateY = useRef(new Animated.Value(0)).current;
  const chatOpacity = useRef(new Animated.Value(0)).current;

  const botSize = Math.min(200, Math.round(windowWidth * 0.48));
  const isUnavailable = mode === 'unavailable';

  /**
   * One wait on the way in, not two.
   *
   * Opening Handy ran two loading states back to back: the availability check,
   * and then reopening the last conversation. They are independent and both
   * start at once, but they were drawn separately - so the orb appeared,
   * vanished, and appeared again, which reads as the screen loading twice
   * because that is exactly what it looked like.
   *
   * They are one wait now, and only while there is nothing on screen yet. That
   * second half matters as much as the first: the availability check can run
   * again, and when it did, a conversation somebody was reading was replaced
   * by a loading orb. Nothing that has already loaded gets taken away to show
   * a wait.
   */
  const isOpening = (isCheckingStatus || isLoadingHistory) && messages.length === 0;

  /**
   * The overlay is for waits that happen over a conversation already on
   * screen - switching threads from the drawer, or raising a booking. Opening
   * is not one of those, and dimming a blank screen was half the flicker.
   */
  const isOverlayVisible = isStartingBooking || (isLoadingHistory && messages.length > 0);

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability]);

  useFocusEffect(
    useCallback(() => {
      applyHandyAiStatusBar();
      return () => {
        applyDefaultStatusBar();
      };
    }, []),
  );

  /**
   * What this screen has already opened.
   *
   * Deciding what to show is a one-off, and this effect was running it more
   * than once - so the conversation was fetched twice, the loading overlay
   * appeared twice, and opening Handy felt twice as slow as it is. The effect
   * depends on callbacks whose identity it cannot control, and React runs
   * effects twice on mount in development besides; either is enough. Rather
   * than chase which, the intent is recorded and repeated work is skipped.
   */
  const openedRef = useRef<string | null>(null);

  useEffect(() => {
    /**
     * What was actually asked for. Two visits asking the same thing are the
     * same visit; asking for a different conversation is a new one.
     */
    const intent =
      params.newChat === 'true'
        ? 'new'
        : params.conversationId
          ? `id:${params.conversationId}`
          : 'resume';

    if (openedRef.current === intent) return;
    openedRef.current = intent;

    if (params.newChat === 'true') {
      void clearHandySession();
      startNewChat();
      return;
    }

    const id = params.conversationId ? parseInt(params.conversationId, 10) : NaN;
    if (!Number.isNaN(id) && id > 0) {
      void loadConversation(id);
      return;
    }

    /**
     * Nothing was asked for, so pick up where they left off.
     *
     * Coming back to Handy used to start from the greeting and the quick-action
     * cards every time, with no sign that the conversation you were halfway
     * through still existed. It did, in the history drawer, but you had to know
     * to go and look; most people would simply start again and repeat
     * themselves to an assistant that had already been told.
     *
     * Only within the session window. An answer to a question you have
     * forgotten asking reads as broken rather than helpful, so an old thread
     * gives way to a fresh greeting.
     */
    void readHandySession().then((remembered) => {
      if (remembered) void loadConversation(remembered);
    });
  }, [loadConversation, params.conversationId, params.newChat, startNewChat]);

  /** Keeps the window open while they are actually using it. */
  useEffect(() => {
    if (conversationId) void rememberHandySession(conversationId);
  }, [conversationId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      setKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
    };
    const onHide = () => setKeyboardInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const collapse = showChatLayout;
    const duration = reducedMotion ? 0 : AI_ANIMATION.welcomeTransitionMs;

    if (reducedMotion) {
      homeOpacity.setValue(collapse ? 0 : 1);
      chatOpacity.setValue(collapse ? 1 : 0);
      homeTranslateY.setValue(collapse ? -24 : 0);
      return;
    }

    runParallel(reducedMotion, [
      Animated.timing(homeOpacity, {
        toValue: collapse ? 0 : 1,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(homeTranslateY, {
        toValue: collapse ? -24 : 0,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(chatOpacity, {
        toValue: collapse ? 1 : 0,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
  }, [chatOpacity, homeOpacity, homeTranslateY, reducedMotion, showChatLayout]);

  /**
   * Starts a fresh conversation from this screen.
   *
   * Clears the remembered session as well as the messages. Without that, the
   * thread would look new until the next time somebody opened Handy, and then
   * the old one would come back - the pointer would still be aimed at it.
   */
  const startFreshChat = useCallback(() => {
    /**
     * Deliberately does not forget the remembered conversation.
     *
     * It used to clear the pointer here, which lost somebody's place for
     * nothing: tapping New chat and then leaving without saying anything meant
     * coming back to a blank greeting, with the real conversation gone from
     * view. Nothing has replaced it yet at this point.
     *
     * The pointer is overwritten the moment a new conversation actually
     * exists - the first reply creates one, and that is when there is
     * genuinely something newer to come back to.
     */
    startNewChat();
  }, [startNewChat]);

  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt('');
    await sendMessage(text);
  }, [prompt, sendMessage]);

  const handleQuickActionPress = useCallback((action: AiQuickAction) => {
    setPrompt(action.promptSeed);
  }, []);

  const handleAttachPress = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('Photo library access is required to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });

    if (result.canceled || result.assets.length === 0) return;

    const uris = result.assets.map((asset) => asset.uri);
    addImagesFromPicker(uris);
  }, [addImagesFromPicker, showError]);

  const handleUseDraft = useCallback(
    async (draft: AiSuggestion) => {
      haptics.medium();

      if (draft.bookingPrefill) {
        setIsStartingBooking(true);

        const photoUris = imagePromptItems
          .filter((item) => item.uri && !item.loading)
          .map((item) => item.uri as string);

        const result = await startAiAssistedBooking(
          router,
          draft.bookingPrefill,
          photoUris,
          conversationId
        );

        setIsStartingBooking(false);

        if (!result.ok) {
          showError(result.error);
          haptics.error();
          return;
        }
        return;
      }

      applySuggestionDraft(draft);
      setPrompt(draft.body);
      showInfo('Draft added to your message. Edit and send when ready.');
    },
    [applySuggestionDraft, conversationId, imagePromptItems, router, showError, showInfo]
  );

  const handleDeleteConversation = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id);
      } catch (error: unknown) {
        showError(getSpecificErrorMessage(error as Error, 'generic'));
      }
    },
    [deleteConversation, showError]
  );

  return (
    <View style={{ flex: 1, backgroundColor: AI_COLORS.screenBase }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={HANDY_AI_STATUS_BAR_BACKGROUND}
        translucent={false}
      />
      <AiAssistantBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {/**
              * A way out that is not the system gesture. Handy is opened from
              * the home screen and from a booking, and on Android there is no
              * edge swipe to fall back on, so leaving meant the hardware button
              * or nothing.
              */}
            <Pressable
              onPress={() => {
                haptics.light();
                navigateBack(router, NAV_FALLBACK.clientHome);
              }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: MIN_TOUCH_TARGET,
                height: MIN_TOUCH_TARGET,
                alignItems: 'flex-start',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={24} color={AI_COLORS.primary} />
            </Pressable>
            <AiMenuButton onPress={() => void openDrawer()} />
          </View>
          {/**
            * Start a new chat, not open the history.
            *
            * The history had two doors: this one and the menu on the left,
            * which is where a list of past conversations belongs. Meanwhile
            * starting fresh had none from here - now that Handy reopens your
            * last thread on the way in, "somewhere else" is the one thing this
            * screen could not offer.
            */}
          <Pressable
            onPress={() => {
              haptics.light();
              startFreshChat();
            }}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            accessibilityHint="Starts a fresh conversation with Handy"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <Plus size={24} color={AI_COLORS.primary} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {isUnavailable ? (
            <AiBotUnavailableView />
          ) : isOpening ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AiThinkingOrb
                label={
                  isCheckingStatus
                    ? `Connecting to ${botName}…`
                    : 'Picking up where you left off…'
                }
              />
            </View>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Animated.View
                  pointerEvents={showChatLayout ? 'none' : 'auto'}
                  style={[
                    showChatLayout ? StyleSheet.absoluteFillObject : { flex: 1 },
                    {
                      opacity: homeOpacity,
                      transform: [{ translateY: homeTranslateY }],
                      zIndex: showChatLayout ? 0 : 1,
                    },
                  ]}
                >
                  {showWelcomeHome ? (
                    <>
                      <View
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 24,
                          paddingTop: 8,
                          paddingBottom: 12,
                        }}
                      >
                        <Animated.View style={mascotAnimatedStyle}>
                          <Image
                            source={AI_BOT_HAPPY}
                            contentFit="contain"
                            style={{
                              width: botSize,
                              height: botSize,
                              marginBottom: 14,
                            }}
                            accessibilityLabel="AI assistant"
                          />
                        </Animated.View>
                        <Text
                          accessibilityLiveRegion="polite"
                          style={{
                            fontFamily: 'Poppins-SemiBold',
                            fontSize: 24,
                            lineHeight: 32,
                            color: AI_ASSISTANT_TEXT.primary,
                            textAlign: 'center',
                            paddingHorizontal: 8,
                          }}
                        >
                          {entranceComplete ? textWithCursor : ''}
                        </Text>
                      </View>

                      <View style={{ flexShrink: 0 }}>
                        <AiQuickActionCarousel onActionPress={handleQuickActionPress} />
                      </View>
                    </>
                  ) : null}
                </Animated.View>

                {showChatLayout ? (
                  <Animated.View style={{ flex: 1, opacity: chatOpacity, zIndex: 1 }}>
                    <AiChatMessageList
                      messages={messages}
                      isBotTyping={isBotTyping}
                      imageUploadMessageId={imageUploadMessageId}
                      imageSlotVisible={imageSlotVisible}
                      imagePromptItems={imagePromptItems}
                      hiddenImageCount={hiddenImageCount}
                      suggestionMessageId={suggestionMessageId}
                      suggestion={suggestion}
                      suggestionVisible={suggestionVisible}
                      onBotMessageRevealed={onBotMessageRevealed}
                      onUseDraft={handleUseDraft}
                    />
                  </Animated.View>
                ) : null}
              </View>

              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: showChatLayout ? 8 : 14,
                  paddingBottom:
                    keyboardInset > 0
                      ? keyboardInset + 8
                      : Math.max(insets.bottom, 8),
                }}
              >
                <AiPromptInput
                  value={prompt}
                  onChangeText={setPrompt}
                  onAttachPress={handleAttachPress}
                  onSend={handleSend}
                  compact={showChatLayout}
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {isOverlayVisible ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: AI_COLORS.historyOverlay,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          {/**
            * Says which wait this is. The overlay covers two of them, and
            * "starting your booking" while a thread is merely being switched
            * would be the app narrating something that is not happening.
            */}
          <AiThinkingOrb
            size={64}
            label={isStartingBooking ? 'Starting your booking…' : 'Opening that chat…'}
          />
        </View>
      ) : null}

      <AiConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeConversationId={conversationId}
        isLoading={isLoadingConversations}
        botName={botName}
        userName={userProfile?.name}
        userEmail={userProfile?.email}
        onClose={closeDrawer}
        onSelect={(id) => void loadConversation(id)}
        onNewChat={startNewChat}
        onSeeAll={() => {
          closeDrawer();
          router.push('/AiConversationsScreen');
        }}
        onDelete={(id) => void handleDeleteConversation(id)}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </View>
  );
}
