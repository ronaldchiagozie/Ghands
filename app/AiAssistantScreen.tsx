import AiAssistantBackground from '@/components/ai/AiAssistantBackground';
import AiMenuButton from '@/components/ai/AiMenuButton';
import AiPromptInput from '@/components/ai/AiPromptInput';
import Toast from '@/components/Toast';
import AiQuickActionCarousel from '@/components/ai/AiQuickActionCarousel';
import AiBotUnavailableView from '@/components/ai/chat/AiBotUnavailableView';
import AiChatMessageList from '@/components/ai/chat/AiChatMessageList';
import type { AiSuggestion } from '@/components/ai/chat/types';
import {
  AI_GREETING,
  AI_ASSISTANT_TEXT,
  type AiQuickAction,
} from '@/components/ai/aiAssistantTheme';
import { useAiChatSession } from '@/hooks/useAiChatSession';
import { useAiMascotAnimation } from '@/hooks/useAiMascotAnimation';
import { useToast } from '@/hooks/useToast';
import { useTypewriterText } from '@/hooks/useTypewriterText';
import { haptics } from '@/hooks/useHaptics';
import { runParallel, useReducedMotion } from '@/lib/designSystem';
import { startAiAssistedBooking } from '@/utils/aiBookingFlow';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const { toast, showError, showInfo, hideToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { animatedStyle: mascotAnimatedStyle, entranceComplete } = useAiMascotAnimation();
  const { textWithCursor } = useTypewriterText(AI_GREETING, 80, {
    active: entranceComplete,
  });
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isStartingBooking, setIsStartingBooking] = useState(false);

  const {
    mode,
    messages,
    isBotTyping,
    suggestion,
    suggestionMessageId,
    suggestionVisible,
    imageUploadMessageId,
    imageSlotVisible,
    imagePromptItems,
    hiddenImageCount,
    sendMessage,
    applySuggestionDraft,
    addImagesFromPicker,
    onBotMessageRevealed,
  } = useAiChatSession();

  const homeOpacity = useRef(new Animated.Value(1)).current;
  const homeTranslateY = useRef(new Animated.Value(0)).current;
  const chatOpacity = useRef(new Animated.Value(0)).current;

  const botSize = Math.min(200, Math.round(windowWidth * 0.48));
  const isChatMode = mode === 'chat';
  const isUnavailable = mode === 'unavailable';
  const isComposing = prompt.length > 0;
  const hasConversation = messages.length > 0;
  const showWelcomeHome =
    mode === 'home' && !hasConversation && !isComposing && !isInputFocused;
  const showChatLayout = !showWelcomeHome;

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

    if (reducedMotion) {
      homeOpacity.setValue(collapse ? 0 : 1);
      chatOpacity.setValue(collapse ? 1 : 0);
      homeTranslateY.setValue(collapse ? -24 : 0);
      return;
    }

    runParallel(reducedMotion, [
      Animated.timing(homeOpacity, {
        toValue: collapse ? 0 : 1,
        duration: 350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(homeTranslateY, {
        toValue: collapse ? -24 : 0,
        duration: 350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(chatOpacity, {
        toValue: collapse ? 1 : 0,
        duration: 350,
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
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });

    if (result.canceled || result.assets.length === 0) return;

    const uris = result.assets.map((asset) => asset.uri);
    addImagesFromPicker(uris);

    if (mode === 'home') {
      await sendMessage('Yes');
    }
  }, [addImagesFromPicker, mode, sendMessage]);

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
          photoUris
        );

        setIsStartingBooking(false);

        if (!result.ok) {
          showError(result.error);
          haptics.error();
          return;
        }

        applySuggestionDraft(draft);
        return;
      }

      applySuggestionDraft(draft);
      setPrompt(draft.body);
      showInfo('Draft added to your message. Edit and send when ready.');
    },
    [applySuggestionDraft, imagePromptItems, router, showError, showInfo]
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#003D4D' }}>
      <StatusBar barStyle="light-content" />
      <AiAssistantBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
            <AiMenuButton />
          </View>

          <View style={{ flex: 1 }}>
            {isUnavailable ? (
              <AiBotUnavailableView />
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
                    <View
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 20,
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
                            marginBottom: 10,
                          }}
                          accessibilityLabel="AI assistant"
                        />
                      </Animated.View>
                      <Text
                        accessibilityLiveRegion="polite"
                        style={{
                          fontFamily: 'Poppins-SemiBold',
                          fontSize: 26,
                          lineHeight: 34,
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
                  </Animated.View>

                  {showChatLayout ? (
                    <Animated.View style={{ flex: 1, opacity: chatOpacity, zIndex: 1 }}>
                      {isChatMode || hasConversation ? (
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
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                    </Animated.View>
                  ) : null}
                </View>

                {!isUnavailable ? (
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
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      onAttachPress={handleAttachPress}
                      onSend={handleSend}
                      compact={showChatLayout}
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>
      </SafeAreaView>

      {isStartingBooking ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 61, 77, 0.45)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <ActivityIndicator size="large" color="#E4FF5C" />
        </View>
      ) : null}

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </View>
  );
}
