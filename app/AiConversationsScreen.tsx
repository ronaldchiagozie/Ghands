import { AI_ASSISTANT_TEXT } from '@/components/ai/aiAssistantTheme';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { aiService, type AiConversationSummary } from '@/services/api';
import { formatTimeAgo } from '@/utils/dateFormatting';
import { handleApiAuthFailure } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { ArrowLeft, MessageSquarePlus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
      Alert.alert(
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
    <SafeAreaWrapper backgroundColor="#003D4D">
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
            <ActivityIndicator size="large" color="#E4FF5C" />
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
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleOpenConversation(item)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: 'Poppins-SemiBold',
                        fontSize: 15,
                        color: AI_ASSISTANT_TEXT.primary,
                        marginBottom: 6,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Poppins-Regular',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.55)',
                      }}
                    >
                      {formatTimeAgo(item.updatedAt)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel="Delete conversation"
                    hitSlop={8}
                    style={{ paddingTop: 2 }}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                    ) : (
                      <Trash2 size={18} color="rgba(255,255,255,0.55)" />
                    )}
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
