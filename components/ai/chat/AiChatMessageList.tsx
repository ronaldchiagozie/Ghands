import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList } from 'react-native';
import { isRenderableUiSuggestion } from '@/utils/aiChatMappers';
import AiChatBotBubble from './AiChatBotBubble';
import AiChatImageRow from './AiChatImageRow';
import AiChatUserBubble from './AiChatUserBubble';
import AiSuggestionCard from './AiSuggestionCard';
import type { AiImageAttachment, AiMessage, AiSuggestion } from './types';

type AiChatListItem =
  | { kind: 'message'; message: AiMessage }
  | { kind: 'typing' }
  | { kind: 'images'; items: AiImageAttachment[]; extraCount: number; key: string }
  | { kind: 'suggestion'; suggestion: AiSuggestion; key: string };

type AiChatMessageListProps = {
  messages: AiMessage[];
  isBotTyping: boolean;
  imageUploadMessageId: string | null;
  imageSlotVisible: boolean;
  imagePromptItems: AiImageAttachment[];
  hiddenImageCount: number;
  suggestionMessageId: string | null;
  suggestion: AiSuggestion | null;
  suggestionVisible: boolean;
  onBotMessageRevealed?: (messageId: string) => void;
  onUseDraft?: (suggestion: AiSuggestion) => void;
};

function buildListItems(
  messages: AiMessage[],
  isBotTyping: boolean,
  imageUploadMessageId: string | null,
  imageSlotVisible: boolean,
  imagePromptItems: AiImageAttachment[],
  hiddenImageCount: number,
  suggestionMessageId: string | null,
  suggestion: AiSuggestion | null,
  suggestionVisible: boolean
): AiChatListItem[] {
  const items: AiChatListItem[] = [];
  let suggestionInserted = false;

  const showSuggestion =
    suggestionVisible && isRenderableUiSuggestion(suggestion);

  messages.forEach((message) => {
    items.push({ kind: 'message', message });

    if (
      message.id === imageUploadMessageId &&
      imageSlotVisible &&
      imagePromptItems.length > 0
    ) {
      items.push({
        kind: 'images',
        items: imagePromptItems.slice(0, 2),
        extraCount: hiddenImageCount,
        key: 'user-images',
      });
    }

    if (
      message.id === suggestionMessageId &&
      showSuggestion
    ) {
      items.push({
        kind: 'suggestion',
        suggestion: suggestion!,
        key: suggestion!.id,
      });
      suggestionInserted = true;
    }
  });

  if (showSuggestion && !suggestionInserted) {
    items.push({
      kind: 'suggestion',
      suggestion: suggestion!,
      key: suggestion!.id,
    });
  }

  if (isBotTyping) {
    items.push({ kind: 'typing' });
  }

  return items;
}

export default function AiChatMessageList({
  messages,
  isBotTyping,
  imageUploadMessageId,
  imageSlotVisible,
  imagePromptItems,
  hiddenImageCount,
  suggestionMessageId,
  suggestion,
  suggestionVisible,
  onBotMessageRevealed,
  onUseDraft,
}: AiChatMessageListProps) {
  const listRef = useRef<FlatList<AiChatListItem>>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = buildListItems(
    messages,
    isBotTyping,
    imageUploadMessageId,
    imageSlotVisible,
    imagePromptItems,
    hiddenImageCount,
    suggestionMessageId,
    suggestion,
    suggestionVisible
  );

  const scrollToBottom = useCallback((animated = true) => {
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }
    scrollDebounceRef.current = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, animated ? 48 : 0);
  }, []);

  useEffect(() => {
    scrollToBottom(true);
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, [data.length, imageSlotVisible, isBotTyping, scrollToBottom, suggestionVisible]);

  const handleRevealComplete = useCallback(
    (messageId: string) => {
      onBotMessageRevealed?.(messageId);
      scrollToBottom(true);
    },
    [onBotMessageRevealed, scrollToBottom]
  );

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item, index) => {
        if (item.kind === 'message') return item.message.id;
        if (item.kind === 'typing') return 'typing';
        if (item.kind === 'suggestion') return item.key;
        return item.key ?? `images-${index}`;
      }}
      renderItem={({ item }) => {
        if (item.kind === 'message') {
          if (item.message.role === 'user') {
            return <AiChatUserBubble message={item.message} />;
          }
          if (!item.message.text.trim()) {
            return null;
          }
          return (
            <AiChatBotBubble
              message={item.message}
              onRevealComplete={handleRevealComplete}
            />
          );
        }

        if (item.kind === 'typing') {
          return (
            <AiChatBotBubble
              message={{ id: 'typing', role: 'assistant', text: '', time: '' }}
              isTypingPlaceholder
            />
          );
        }

        if (item.kind === 'suggestion') {
          return (
            <AiSuggestionCard
              suggestion={item.suggestion}
              visible
              onUseDraft={(draft) => onUseDraft?.(draft)}
            />
          );
        }

        return (
          <AiChatImageRow
            items={item.items}
            extraCount={item.extraCount}
            visible
          />
        );
      }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => scrollToBottom(false)}
    />
  );
}
