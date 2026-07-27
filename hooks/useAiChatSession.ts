import { resolvePostImageAnalysisTurn } from '@/components/ai/chat/aiChatResponses';
import type {
  AiImageAttachment,
  AiMessage,
  AiSuggestion,
  AiViewMode,
} from '@/components/ai/chat/types';
import { formatAiChatTime } from '@/hooks/useRevealText';
import { haptics } from '@/hooks/useHaptics';
import { aiService, type AiConversationSummary } from '@/services/api';
import {
  mapChatResponseToUi,
  mapStoredMessageToUi,
  isRenderableUiSuggestion,
} from '@/utils/aiChatMappers';
import { botMessageRequestsPhotos } from '@/utils/aiChatPhotoPrompt';
import { handleApiAuthFailure } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useAiChatSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<AiViewMode>('home');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [botName, setBotName] = useState('Handy');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<AiSuggestion | null>(null);
  const [suggestionMessageId, setSuggestionMessageId] = useState<string | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const [imageUploadMessageId, setImageUploadMessageId] = useState<string | null>(null);
  const [imageSlotVisible, setImageSlotVisible] = useState(false);
  const [imagePromptItems, setImagePromptItems] = useState<AiImageAttachment[]>([]);
  const [hiddenImageCount, setHiddenImageCount] = useState(0);
  const replyTokenRef = useRef(0);
  const postImageAnalysisTriggeredRef = useRef(false);
  const imageUploadMessageIdRef = useRef<string | null>(null);
  const suggestionMessageIdRef = useRef<string | null>(null);
  const pendingSuggestionRef = useRef<AiSuggestion | null>(null);
  const conversationIdRef = useRef<number | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  conversationIdRef.current = conversationId;
  imageUploadMessageIdRef.current = imageUploadMessageId;
  suggestionMessageIdRef.current = suggestionMessageId;
  pendingSuggestionRef.current = pendingSuggestion;

  const revealSuggestionNow = useCallback((next: AiSuggestion) => {
    if (!isRenderableUiSuggestion(next)) return;
    setSuggestion(next);
    setSuggestionVisible(true);
  }, []);

  const clearSuggestionState = useCallback(() => {
    setSuggestionVisible(false);
    setSuggestion(null);
    setPendingSuggestion(null);
    pendingSuggestionRef.current = null;
    suggestionMessageIdRef.current = null;
    setSuggestionMessageId(null);
  }, []);

  const resetChatState = useCallback(() => {
    replyTokenRef.current += 1;
    setConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setMode('home');
    clearSuggestionState();
    setImageUploadMessageId(null);
    imageUploadMessageIdRef.current = null;
    setImageSlotVisible(false);
    setImagePromptItems([]);
    setHiddenImageCount(0);
    setIsBotTyping(false);
  }, [clearSuggestionState]);

  const attachSuggestion = useCallback(
    (botMessageId: string, next: AiSuggestion, revealAfterMs?: number) => {
      if (!isRenderableUiSuggestion(next)) return;

      setSuggestionMessageId(botMessageId);
      setPendingSuggestion(next);
      suggestionMessageIdRef.current = botMessageId;
      pendingSuggestionRef.current = next;

      if (revealAfterMs != null) {
        const token = replyTokenRef.current;
        setTimeout(() => {
          if (replyTokenRef.current !== token) return;
          if (suggestionMessageIdRef.current !== botMessageId) return;
          if (!pendingSuggestionRef.current) return;
          revealSuggestionNow(pendingSuggestionRef.current);
        }, revealAfterMs);
      }
    },
    [revealSuggestionNow]
  );

  const refreshConversations = useCallback(async () => {
    try {
      const items = await aiService.listConversations(20);
      setConversations(items);
    } catch (error: unknown) {
      await handleApiAuthFailure(error, router, pathname);
    }
  }, [pathname, router]);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);

  const openDrawer = useCallback(async () => {
    haptics.light();
    setDrawerVisible(true);
    setIsLoadingConversations(true);
    try {
      const items = await aiService.listConversations(20);
      setConversations(items);
    } catch (error: unknown) {
      if (await handleApiAuthFailure(error, router, pathname)) return;
    } finally {
      setIsLoadingConversations(false);
    }
  }, [pathname, router]);

  const checkAvailability = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const status = await aiService.getStatus();
      if (!status.available) {
        setMode('unavailable');
      }
      if (status.botName) {
        setBotName(status.botName);
      }
    } catch (error: unknown) {
      if (await handleApiAuthFailure(error, router, pathname)) return;
    } finally {
      setIsCheckingStatus(false);
    }
  }, [pathname, router]);

  const startNewChat = useCallback(() => {
    resetChatState();
    closeDrawer();
  }, [closeDrawer, resetChatState]);

  const startNewConversation = startNewChat;

  const deleteConversation = useCallback(
    async (id: number) => {
      try {
        await aiService.deleteConversation(id);
        setConversations((prev) => prev.filter((item) => item.id !== id));
        if (conversationIdRef.current === id) {
          resetChatState();
        }
        haptics.success();
      } catch (error: unknown) {
        if (await handleApiAuthFailure(error, router, pathname)) return;
        throw error;
      }
    },
    [pathname, resetChatState, router]
  );

  const loadConversation = useCallback(
    async (id: number) => {
      closeDrawer();
      replyTokenRef.current += 1;
      clearSuggestionState();
      setIsLoadingHistory(true);
      setMode('chat');

      try {
        const detail = await aiService.getConversationMessages(id);
        setConversationId(detail.conversation.id);
        conversationIdRef.current = detail.conversation.id;

        const mappedMessages: AiMessage[] = [];
        let lastSuggestion: AiSuggestion | null = null;
        let lastSuggestionMessageId: string | null = null;

        detail.messages.forEach((stored) => {
          const { message, suggestion: mappedSuggestion } = mapStoredMessageToUi(stored);
          mappedMessages.push(message);
          if (mappedSuggestion && stored.role === 'assistant') {
            lastSuggestion = mappedSuggestion;
            lastSuggestionMessageId = message.id;
          }
        });

        setMessages(mappedMessages);

        if (lastSuggestion && lastSuggestionMessageId && isRenderableUiSuggestion(lastSuggestion)) {
          setSuggestionMessageId(lastSuggestionMessageId);
          suggestionMessageIdRef.current = lastSuggestionMessageId;
          revealSuggestionNow(lastSuggestion);
        }
      } catch (error: unknown) {
        if (await handleApiAuthFailure(error, router, pathname)) return;
        const botMessage: AiMessage = {
          id: `bot-error-${Date.now()}`,
          role: 'assistant',
          text: getSpecificErrorMessage(error as Error, 'generic'),
          time: formatAiChatTime(),
          revealText: false,
        };
        setMessages([botMessage]);
      } finally {
        setIsLoadingHistory(false);
        setIsBotTyping(false);
      }
    },
    [clearSuggestionState, closeDrawer, pathname, revealSuggestionNow, router]
  );

  const applyAssistantChatResponse = useCallback(
    (
      response: Awaited<ReturnType<typeof aiService.sendMessage>>,
      token: number
    ) => {
      if (replyTokenRef.current !== token) return;

      setConversationId(response.conversationId);
      conversationIdRef.current = response.conversationId;

      const { botMessage, suggestion: mappedSuggestion } = mapChatResponseToUi(response);
      setMessages((prev) => [...prev, botMessage]);

      if (botMessageRequestsPhotos(botMessage.text)) {
        postImageAnalysisTriggeredRef.current = false;
        imageUploadMessageIdRef.current = botMessage.id;
        setImageUploadMessageId(botMessage.id);
        setImagePromptItems([]);
        setHiddenImageCount(0);
        setImageSlotVisible(false);
      }

      if (mappedSuggestion) {
        if (response.responseType === 'suggestion') {
          revealSuggestionNow(mappedSuggestion);
          setSuggestionMessageId(botMessage.id);
          suggestionMessageIdRef.current = botMessage.id;
        } else {
          attachSuggestion(
            botMessage.id,
            mappedSuggestion,
            botMessage.text.length * 16 + 160
          );
        }
      }
    },
    [attachSuggestion, revealSuggestionNow]
  );

  const runPostImageAnalysis = useCallback(async () => {
    if (postImageAnalysisTriggeredRef.current) return;

    postImageAnalysisTriggeredRef.current = true;

    const token = ++replyTokenRef.current;
    const turn = resolvePostImageAnalysisTurn(messagesRef.current);

    clearSuggestionState();
    setIsBotTyping(true);

    await wait(turn.thinkingMs ?? 1200);
    if (replyTokenRef.current !== token) return;

    setIsBotTyping(false);

    const botMessageId = `bot-${Date.now()}`;
    const botMessage: AiMessage = {
      id: botMessageId,
      role: 'assistant',
      text: turn.text,
      time: formatAiChatTime(),
      revealText: turn.revealText ?? true,
    };

    setMessages((prev) => [...prev, botMessage]);

    if (turn.suggestion && isRenderableUiSuggestion(turn.suggestion)) {
      attachSuggestion(
        botMessageId,
        turn.suggestion,
        turn.text.length * 16 + 160
      );
    }
  }, [attachSuggestion, clearSuggestionState]);

  const submitImagesToHandy = useCallback(
    async (localUris: string[]) => {
      const token = ++replyTokenRef.current;
      setIsBotTyping(true);
      clearSuggestionState();

      try {
        const response = await aiService.sendMessageWithImages({
          message:
            localUris.length === 1
              ? 'Here is a photo of the issue.'
              : `Here are ${localUris.length} photos of the issue.`,
          ...(conversationIdRef.current != null
            ? { conversationId: conversationIdRef.current }
            : {}),
          localUris,
        });

        setImagePromptItems((prev) =>
          prev.map((item, index) => ({
            ...item,
            loading: false,
            uri: item.uri || localUris[index] || item.uri,
          }))
        );

        applyAssistantChatResponse(response, token);
        void refreshConversations();
      } catch (error: unknown) {
        if (replyTokenRef.current !== token) return;
        if (await handleApiAuthFailure(error, router, pathname)) return;

        setImagePromptItems((prev) => prev.map((item) => ({ ...item, loading: false })));
        await runPostImageAnalysis();
      } finally {
        if (replyTokenRef.current === token) {
          setIsBotTyping(false);
        }
      }
    },
    [
      applyAssistantChatResponse,
      clearSuggestionState,
      pathname,
      refreshConversations,
      router,
      runPostImageAnalysis,
    ]
  );

  const openImageUploadSlot = useCallback((botMessageId: string) => {
    postImageAnalysisTriggeredRef.current = false;
    imageUploadMessageIdRef.current = botMessageId;
    setImageUploadMessageId(botMessageId);
    setImagePromptItems([]);
    setHiddenImageCount(0);
    setImageSlotVisible(false);
  }, []);

  const onBotMessageRevealed = useCallback(
    (messageId: string) => {
      if (
        messageId === suggestionMessageIdRef.current &&
        pendingSuggestionRef.current
      ) {
        revealSuggestionNow(pendingSuggestionRef.current);
      }
    },
    [revealSuggestionNow]
  );

  const addImagesFromPicker = useCallback(
    (uris: string[]) => {
      if (uris.length === 0) return;

      haptics.light();

      let anchorId = imageUploadMessageIdRef.current;
      if (!anchorId) {
        anchorId = `user-${Date.now()}`;
        const userMessage: AiMessage = {
          id: anchorId,
          role: 'user',
          text: uris.length === 1 ? 'Photo attached' : `${uris.length} photos attached`,
          time: formatAiChatTime(),
        };
        setMessages((prev) => [...prev, userMessage]);
        if (mode === 'home') {
          setMode('chat');
        }
        imageUploadMessageIdRef.current = anchorId;
        setImageUploadMessageId(anchorId);
      }

      const pending = uris.map((uri, index) => ({
        id: `picked-${Date.now()}-${index}`,
        uri,
        loading: true,
      }));

      setImagePromptItems((prev) => {
        const combined = [...prev, ...pending];
        setHiddenImageCount(Math.max(combined.length - 2, 0));
        return combined;
      });

      setImageSlotVisible(true);

      void submitImagesToHandy(uris);
    },
    [mode, submitImagesToHandy]
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isBotTyping || mode === 'unavailable') return;

      haptics.selection();
      clearSuggestionState();

      const userMessage: AiMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        time: formatAiChatTime(),
      };

      setMessages((prev) => [...prev, userMessage]);
      if (mode === 'home') {
        setMode('chat');
      }

      const token = ++replyTokenRef.current;
      setIsBotTyping(true);

      try {
        const response = await aiService.sendMessage({
          message: text,
          ...(conversationIdRef.current != null
            ? { conversationId: conversationIdRef.current }
            : {}),
        });

        if (replyTokenRef.current !== token) return;

        applyAssistantChatResponse(response, token);

        void refreshConversations();
      } catch (error: unknown) {
        if (replyTokenRef.current !== token) return;
        if (await handleApiAuthFailure(error, router, pathname)) return;

        const botMessage: AiMessage = {
          id: `bot-error-${Date.now()}`,
          role: 'assistant',
          text: getSpecificErrorMessage(error as Error, 'generic'),
          time: formatAiChatTime(),
          revealText: false,
        };
        setMessages((prev) => [...prev, botMessage]);
      } finally {
        if (replyTokenRef.current === token) {
          setIsBotTyping(false);
        }
      }
    },
    [
      applyAssistantChatResponse,
      clearSuggestionState,
      isBotTyping,
      mode,
      pathname,
      refreshConversations,
      router,
    ]
  );

  const applySuggestionDraft = useCallback((draft: AiSuggestion) => {
    haptics.medium();
    setSuggestionVisible(false);
    return draft.body;
  }, []);

  const showWelcomeHome = mode === 'home' && messages.length === 0;
  const showChatLayout = mode === 'chat' || messages.length > 0;

  return {
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
    startNewConversation,
    startNewChat,
    openDrawer,
    closeDrawer,
    deleteConversation,
    refreshConversations,
  };
}
