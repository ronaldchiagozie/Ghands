import { AI_ASSISTANT_TEXT, AI_COLORS } from '@/components/ai/aiAssistantTheme';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { aiService, type AiConversationSummary } from '@/services/api';
import { formatTimeAgo } from '@/utils/dateFormatting';
import { handleApiAuthFailure } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { ArrowLeft, MessageSquarePlus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';

export default function AiConversationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { showError } = useToast();
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await aiService.listConversations(20);
      setConversations(items);
    } catch (error: unknown) {
      if (await handleApiAuthFailure(error, router, pathname)) return;
      showError(getSpecificErrorMessage(error as Error, 'generic'));
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router, showError]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  const handleOpenConversation = useCallback(
    (conversation: AiConversationSummary) => {
      haptics.light();
      router.push({
        pathname: '/AiAssistantScreen' as any,
        params: { conversationId: String(conversation.id) },
      } as any);
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    haptics.light();
    router.push({
      pathname: '/AiAssistantScreen' as any,
      params: { newChat: 'true' },
    } as any);
  }, [router]);

  const handleDelete = useCallback(
    (conversation: AiConversationSummary) => {
      showAppAlert(
        'Delete conversation',
        'This chat will be removed permanently.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(conversation.id);
              try {
                await aiService.deleteConversation(conversation.id);
                setConversations((prev) => prev.filter((item) => item.id !== conversation.id));
                haptics.success();
              } catch (error: unknown) {
                if (await handleApiAuthFailure(error, router, pathname)) return;
                showError(getSpecificErrorMessage(error as Error, 'generic'));
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [pathname, router, showError]
  );

  return (
    <SafeAreaWrapper backgroundColor={AI_COLORS.screenBase}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 4,
            }}
          >
            <ArrowLeft size={22} color={AI_ASSISTANT_TEXT.primary} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: 'Poppins-Bold',
              fontSize: 18,
              color: AI_ASSISTANT_TEXT.primary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            Chat history
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleNewChat}
          accessibilityRole="button"
          accessibilityLabel="Start new chat"
          hitSlop={8}
          style={{
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageSquarePlus size={22} color={AI_ASSISTANT_TEXT.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={AI_COLORS.accent} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text
              style={{
                fontFamily: 'Poppins-SemiBold',
                fontSize: 18,
                color: AI_ASSISTANT_TEXT.primary,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              No conversations yet
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Ask Handy a question to start your first chat.
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28, paddingTop: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleOpenConversation(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open chat: ${item.title}`}
                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
              >
                {/**
                  * Every visual property on this inner View, and none on the
                  * Pressable.
                  *
                  * This row used to carry its background, border, radius and
                  * padding in a `style={({ pressed }) => ({...})}` function on
                  * the Pressable itself. NativeWind wraps these elements and
                  * flattens a function style, so all of it was silently
                  * dropped - which is why the list arrived as bare text lines
                  * pressed against each other with no card, no padding and no
                  * gap. Nothing was wrong with the spacing values; they were
                  * never applied.
                  */}
                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                    borderRadius: BorderRadius.lg,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.11)',
                    paddingHorizontal: 16,
                    paddingVertical: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 14 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: 'Poppins-SemiBold',
                        fontSize: 14.5,
                        lineHeight: 21,
                        letterSpacing: -0.1,
                        color: AI_ASSISTANT_TEXT.primary,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins-Regular',
                        fontSize: 11.5,
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginTop: 7,
                      }}
                    >
                      {formatTimeAgo(item.updatedAt)}
                    </Text>
                  </View>

                  {/**
                    * A real target rather than a bare glyph, so deleting the
                    * wrong chat takes a deliberate tap.
                    */}
                  <Pressable
                    onPress={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete chat: ${item.title}`}
                    hitSlop={10}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color={AI_COLORS.muted} />
                      ) : (
                        <Trash2 size={16} color={AI_COLORS.muted} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaWrapper>
  );
}
