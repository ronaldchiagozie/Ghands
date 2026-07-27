import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { haptics } from '@/hooks/useHaptics';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, Spacing } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, CheckCheck, Headphones, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hello, I need help with my account',
    sender: 'user',
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    time: '2:10pm',
    status: 'read',
  },
  {
    id: '2',
    text: 'Hi. What do you need help with on your account?',
    sender: 'support',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    time: '2:12pm',
  },
];

// Auto-response messages for support chat demo
const SUPPORT_RESPONSES = [
  "Got it. Here's what we can do next.",
  "Thanks for the message. We're looking into it.",
  "I see the issue. Here's what we can do to resolve it.",
  "Here's a quick explanation.",
  "Can you share a bit more detail?",
  "Still working on this. We'll update you shortly.",
  "We'll pass this to our technical team.",
  "Here's how we can handle this.",
];

export default function LiveChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [message, setMessage] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [footerHeight, setFooterHeight] = useState(72);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  // Format time helper
  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  // Simulate auto-response for demo
  useEffect(() => {
    // Auto-respond if last message is from user
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'user') {
        const timeout = setTimeout(() => {
          const randomResponse = SUPPORT_RESPONSES[Math.floor(Math.random() * SUPPORT_RESPONSES.length)];
          const newMessage: Message = {
            id: `response-${Date.now()}`,
            text: randomResponse,
            sender: 'support',
            timestamp: new Date().toISOString(),
            time: formatTime(new Date()),
          };
          setMessages((prev) => [...prev, newMessage]);
          haptics.light();
        }, 2000); // 2 second delay for realistic feel

        return () => clearTimeout(timeout);
      }
    }
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(true), 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      setKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
      setTimeout(() => scrollToBottom(true), 50);
    };
    const onHide = () => setKeyboardInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  const handleSend = () => {
    if (message.trim()) {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        text: message.trim(),
        sender: 'user',
        timestamp: new Date().toISOString(),
        time: formatTime(new Date()),
        status: 'sent',
      };
      setMessages((prev) => [...prev, newMessage]);
      setMessage('');
      haptics.selection();
      
      // Simulate message status progression
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: 'delivered' as const } : msg
          )
        );
      }, 1000);
      
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: 'read' as const } : msg
          )
        );
      }, 2000);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    
    const getStatusIcon = () => {
      if (!isUser || !item.status) return null;
      switch (item.status) {
        case 'sending':
          return <View style={{ width: 12, height: 12 }} />;
        case 'sent':
          return <Check size={12} color={Colors.textSecondaryDark} style={{ marginLeft: 4 }} />;
        case 'delivered':
          return <CheckCheck size={12} color={Colors.textSecondaryDark} style={{ marginLeft: 4 }} />;
        case 'read':
          return <CheckCheck size={12} color={Colors.accent} style={{ marginLeft: 4 }} />;
        default:
          return null;
      }
    };
    
    return (
      <View
        key={item.id}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          marginBottom: Spacing.md,
          marginHorizontal: Spacing.md,
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Avatar on left for support messages */}
        {!isUser && (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.sm,
            }}
          >
            <Headphones size={18} color={Colors.white} />
          </View>
        )}

        <View
          style={{
            maxWidth: '75%',
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {/* Message Bubble */}
          <View
            style={{
              backgroundColor: isUser ? Colors.accent : Colors.white,
              borderRadius: BorderRadius.lg,
              borderTopLeftRadius: !isUser ? 4 : BorderRadius.lg,
              borderTopRightRadius: isUser ? 4 : BorderRadius.lg,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm + 2,
              borderWidth: !isUser ? 1 : 0,
              borderColor: Colors.borderSage,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-Regular',
                color: isUser ? Colors.white : Colors.textPrimary,
                lineHeight: 20,
              }}
            >
              {item.text}
            </Text>
          </View>
          
          {/* Timestamp and Status */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
              }}
            >
              {isUser ? 'You' : 'Support'}, {item.time}
            </Text>
            {getStatusIcon()}
          </View>
        </View>

        {/* Avatar on right for user messages */}
        {isUser && (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.backgroundGray,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: Spacing.sm,
            }}
          >
            <Image
              source={require('../assets/images/userimg.jpg')}
              style={{
                width: 36,
                height: 36,
                borderRadius: BorderRadius.full,
              }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.white} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderSage,
            backgroundColor: Colors.white,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.back();
            }}
            activeOpacity={0.7}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.sageTint,
            }}
          >
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: BorderRadius.full,
                backgroundColor: Colors.sageTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Headphones size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                Support team
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.successForeground,
                  marginTop: 1,
                }}
              >
                Online · usually replies quickly
              </Text>
            </View>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingVertical: Spacing.md,
            paddingBottom: footerHeight + 12,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: Colors.sageSurface }}
        />

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: keyboardInset,
          }}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== footerHeight) {
              setFooterHeight(nextHeight);
            }
          }}
        >
          <View
            style={{
              paddingHorizontal: 14,
              paddingBottom: keyboardInset > 0 ? 6 : Math.max(insets.bottom, 8),
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: Colors.borderSage,
              backgroundColor: Colors.white,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Colors.sageSurface,
                borderRadius: BorderRadius.full,
                borderWidth: 1,
                borderColor: Colors.borderSage,
                paddingHorizontal: 12,
                paddingVertical: 6,
                minHeight: 52,
              }}
            >
              <TextInput
                placeholder="Type a message..."
                value={message}
                onChangeText={setMessage}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                  paddingVertical: Platform.OS === 'ios' ? 8 : 6,
                  paddingHorizontal: 4,
                  maxHeight: 100,
                }}
                placeholderTextColor={Colors.placeholder}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSend}
                disabled={!message.trim()}
                style={{
                  width: MIN_TOUCH_TARGET,
                  height: MIN_TOUCH_TARGET,
                  borderRadius: BorderRadius.full,
                  backgroundColor: message.trim() ? Colors.accent : Colors.borderSage,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                }}
              >
                <Send size={18} color={message.trim() ? Colors.white : Colors.textSecondaryDark} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}

