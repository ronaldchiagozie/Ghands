import AiAssistantBackground from '@/components/ai/AiAssistantBackground';
import AiConversationDrawer from '@/components/ai/AiConversationDrawer';
import AiMenuButton from '@/components/ai/AiMenuButton';
import AiPromptInput from '@/components/ai/AiPromptInput';
import Toast from '@/components/Toast';
import AiQuickActionCarousel from '@/components/ai/AiQuickActionCarousel';
import AiBotUnavailableView from '@/components/ai/chat/AiBotUnavailableView';
import AiChatMessageList from '@/components/ai/chat/AiChatMessageList';
import type { AiSuggestion } from '@/components/ai/chat/types';
import {
  AI_ANIMATION,
  AI_CHAT_UI,
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
import { runParallel, useReducedMotion } from '@/lib/designSystem';
import { applyDefaultStatusBar, applyHandyAiStatusBar, HANDY_AI_STATUS_BAR_BACKGROUND } from '@/utils/statusBar';
import { startAiAssistedBooking } from '@/utils/aiBookingFlow';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  type KeyboardEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const isOverlayVisible = isStartingBooking || isLoadingHistory;

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

  useEffect(() => {
    if (params.newChat === 'true') {
      startNewChat();
      return;
    }

    const id = params.conversationId ? parseInt(params.conversationId, 10) : NaN;
    if (!Number.isNaN(id) && id > 0) {
      void loadConversation(id);
    }
  }, [loadConversation, params.conversationId, params.newChat, startNewChat]);

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
            justifyContent: 'flex-start',
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <AiMenuButton onPress={() => void openDrawer()} />
        </View>

        <View style={{ flex: 1 }}>
          {isUnavailable ? (
            <AiBotUnavailableView />
          ) : isCheckingStatus ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <ActivityIndicator size="large" color={AI_CHAT_UI.spinnerOnGradient} />
              <Text
                style={{
                  fontFamily: 'Poppins-Regular',
                  fontSize: 14,
                  color: AI_COLORS.subtle,
                }}
              >
                {`Connecting to ${botName}…`}
              </Text>
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
          <ActivityIndicator size="large" color={AI_CHAT_UI.spinnerOnGradient} />
          {isStartingBooking ? (
            <Text
              style={{
                marginTop: 12,
                fontFamily: 'Poppins-Medium',
                fontSize: 14,
                color: AI_COLORS.primary,
              }}
            >
              Starting your booking...
            </Text>
          ) : null}
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
