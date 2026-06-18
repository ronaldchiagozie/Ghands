import {
  resolveAiChatTurn,
  resolvePostImageAnalysisTurn,
} from '@/components/ai/chat/aiChatResponses';
import type {
  AiImageAttachment,
  AiMessage,
  AiSuggestion,
  AiViewMode,
} from '@/components/ai/chat/types';
import { formatAiChatTime } from '@/hooks/useRevealText';
import { haptics } from '@/hooks/useHaptics';
import { useCallback, useRef, useState } from 'react';

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function inferIssueLabel(messages: AiMessage[], userText: string): string {
  const haystack = [...messages.map((m) => m.text), userText].join(' ').toLowerCase();
  if (/\bac|air.?condition|1\.5hp|hp\b/.test(haystack)) return 'Air Conditioner';
  if (/\b(sink|drain|gurgling|plumb|pipe)\b/.test(haystack)) return 'plumbing';
  return 'service';
}

export function useAiChatSession() {
  const [mode, setMode] = useState<AiViewMode>('home');
  const [messages, setMessages] = useState<AiMessage[]>([]);
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
  const uploadTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const postImageAnalysisTriggeredRef = useRef(false);
  const imageUploadMessageIdRef = useRef<string | null>(null);
  const suggestionMessageIdRef = useRef<string | null>(null);
  const pendingSuggestionRef = useRef<AiSuggestion | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  imageUploadMessageIdRef.current = imageUploadMessageId;
  suggestionMessageIdRef.current = suggestionMessageId;
  pendingSuggestionRef.current = pendingSuggestion;

  const revealSuggestionNow = useCallback((next: AiSuggestion) => {
    setSuggestion(next);
    setSuggestionVisible(true);
  }, []);

  const runPostImageAnalysis = useCallback(async () => {
    if (postImageAnalysisTriggeredRef.current) return;
    if (!imageUploadMessageIdRef.current) return;

    postImageAnalysisTriggeredRef.current = true;

    const token = ++replyTokenRef.current;
    const turn = resolvePostImageAnalysisTurn(messagesRef.current);

    setSuggestionVisible(false);
    setSuggestion(null);
    setPendingSuggestion(null);
    pendingSuggestionRef.current = null;
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

    if (turn.suggestion) {
      setSuggestionMessageId(botMessageId);
      setPendingSuggestion(turn.suggestion);
      suggestionMessageIdRef.current = botMessageId;
      pendingSuggestionRef.current = turn.suggestion;

      const typewriterMs = turn.text.length * 16 + 160;
      setTimeout(() => {
        if (replyTokenRef.current !== token) return;
        if (suggestionMessageIdRef.current !== botMessageId) return;
        if (!pendingSuggestionRef.current) return;
        revealSuggestionNow(pendingSuggestionRef.current);
      }, typewriterMs);
    }
  }, [revealSuggestionNow]);

  const simulateUploadComplete = useCallback(
    (ids: string[], uris: string[]) => {
      if (ids.length === 0) return;

      const lastId = ids[ids.length - 1];

      ids.forEach((id, index) => {
        const timer = setTimeout(() => {
          setImagePromptItems((prev) => {
            const next = prev.map((item) =>
              item.id === id ? { ...item, uri: uris[index], loading: false } : item
            );

            if (id === lastId && next.every((item) => !item.loading)) {
              setTimeout(() => {
                void runPostImageAnalysis();
              }, 60);
            }

            return next;
          });
        }, 900 + index * 350);
        uploadTimersRef.current.push(timer);
      });
    },
    [runPostImageAnalysis]
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

      simulateUploadComplete(
        pending.map((item) => item.id),
        uris
      );
    },
    [simulateUploadComplete]
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isBotTyping || mode === 'unavailable') return;

      haptics.selection();
      setSuggestionVisible(false);
      setSuggestion(null);
      setPendingSuggestion(null);
      pendingSuggestionRef.current = null;
      suggestionMessageIdRef.current = null;

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
      const turn = resolveAiChatTurn(text, messages, inferIssueLabel(messages, text));

      if (turn.markUnavailable) {
        setMode('unavailable');
        return;
      }

      setIsBotTyping(true);

      await wait(turn.thinkingMs ?? 900);
      if (replyTokenRef.current !== token) return;

      setIsBotTyping(false);

      if (turn.text) {
        const botMessageId = `bot-${Date.now()}`;
        const botMessage: AiMessage = {
          id: botMessageId,
          role: 'assistant',
          text: turn.text,
          time: formatAiChatTime(),
          revealText: turn.revealText ?? true,
        };
        setMessages((prev) => [...prev, botMessage]);

        if (turn.showImagePrompt) {
          openImageUploadSlot(botMessageId);
        }

        if (turn.suggestion) {
          setSuggestionMessageId(botMessageId);
          setPendingSuggestion(turn.suggestion);
          suggestionMessageIdRef.current = botMessageId;
          pendingSuggestionRef.current = turn.suggestion;
        }
      } else if (turn.suggestion) {
        const anchorId = `suggestion-anchor-${Date.now()}`;
        setSuggestionMessageId(anchorId);
        setPendingSuggestion(turn.suggestion);
        suggestionMessageIdRef.current = anchorId;
        pendingSuggestionRef.current = turn.suggestion;
        setTimeout(() => {
          if (replyTokenRef.current !== token) return;
          revealSuggestionNow(turn.suggestion!);
        }, 360);
      }
    },
    [isBotTyping, messages, mode, openImageUploadSlot, revealSuggestionNow]
  );

  const applySuggestionDraft = useCallback((draft: AiSuggestion) => {
    haptics.medium();
    setSuggestionVisible(false);
    return draft.body;
  }, []);

  return {
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
  };
}
