import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors, Spacing, BorderRadius, SHADOWS } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, Image as ImageIcon, Mic, Headphones, Check, CheckCheck } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { haptics } from '@/hooks/useHaptics';

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
    text: 'Hello! I\'m here to help. What specific issue are you experiencing with your account?',
    sender: 'support',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    time: '2:12pm',
  },
];

// Auto-response messages for support chat demo
const SUPPORT_RESPONSES = [
  "I understand your concern. Let me help you with that right away.",
  "Thank you for reaching out! I'm looking into this for you.",
  "I see the issue. Here's what we can do to resolve it...",
  "That's a common question. Let me explain...",
  "I'm here to help! Can you provide a bit more detail?",
  "Thank you for your patience. I'm working on finding a solution for you.",
  "I understand. Let me transfer this to our technical team.",
  "Great question! Here's how we can handle this...",
];

export default function LiveChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

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
          return <CheckCheck size={12} color="#4F46E5" style={{ marginLeft: 4 }} />;
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
              borderRadius: 18,
              backgroundColor: '#3B82F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.sm,
              ...SHADOWS.sm,
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
              ...(!isUser ? SHADOWS.sm : {}),
              borderWidth: !isUser ? 1 : 0,
              borderColor: Colors.border,
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
              borderRadius: 18,
              backgroundColor: Colors.backgroundGray,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: Spacing.sm,
              ...SHADOWS.sm,
            }}
          >
            <Image
              source={require('../assets/images/userimg.jpg')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
              }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md + 4,
            paddingBottom: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            backgroundColor: Colors.white,
            ...SHADOWS.sm,
          }}
        >
          <TouchableOpacity 
            onPress={() => {
              haptics.light();
              router.back();
            }} 
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
            }}
          >
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#3B82F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.sm,
                overflow: 'hidden',
              }}
            >
              <Headphones size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                Support Team
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: '#10B981',
                  marginTop: 2,
                }}
              >
                Online, usually replies instantly
              </Text>
            </View>
          </View>
        </View>

        {/* Messages Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ 
            paddingVertical: Spacing.md,
            paddingBottom: Spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        />

        {/* Input Field */}
        <View
          style={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.lg,
            paddingTop: Spacing.sm,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.white,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.xl,
              borderWidth: 1,
              borderColor: Colors.border,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              minHeight: 48,
            }}
          >
            <TouchableOpacity 
              onPress={() => {
                haptics.light();
                // Image picker action
              }}
              activeOpacity={0.7} 
              style={{ 
                marginRight: Spacing.sm,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
              }}
            >
              <ImageIcon size={20} color={Colors.textSecondaryDark} />
            </TouchableOpacity>
            
            <TextInput
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              style={{
                flex: 1,
                fontSize: 15,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                paddingVertical: Spacing.sm,
                maxHeight: 100,
              }}
              placeholderTextColor={Colors.placeholder}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            
            {message.trim() ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSend}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: Spacing.sm,
                  ...SHADOWS.sm,
                }}
              >
                <Send size={18} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  haptics.light();
                  // Voice message action
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: Spacing.sm,
                  ...SHADOWS.sm,
                }}
              >
                <Mic size={18} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

