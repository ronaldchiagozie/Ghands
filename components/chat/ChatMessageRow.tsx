import { Colors } from '@/lib/designSystem';
import { androidElevation, iosOnlyShadow } from '@/lib/surfaceStyles';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AlertCircle, Check, CheckCheck } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type ChatMessageRowMessage = {
  id: string;
  text: string;
  sender: 'user' | 'provider';
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isFromCurrentUser?: boolean;
};

type ChatMessageRowProps = {
  message: ChatMessageRowMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  animateEnter: boolean;
  onRetry?: () => void;
  onLongPress?: () => void;
};

export default function ChatMessageRow({
  message,
  isFirstInGroup,
  isLastInGroup,
  animateEnter,
  onRetry,
  onLongPress,
}: ChatMessageRowProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(animateEnter && !reducedMotion ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animateEnter && !reducedMotion ? 10 : 0)).current;

  const isFromCurrentUser = message.isFromCurrentUser ?? false;
  const isFromProvider = message.sender === 'provider';
  const showAvatar = !isFromCurrentUser && isLastInGroup;
  const showMeta = isLastInGroup;

  useEffect(() => {
    if (!animateEnter || reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 140,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateEnter, opacity, reducedMotion, translateY]);

  const getStatusIcon = () => {
    if (!isFromCurrentUser || !message.status) return null;
    switch (message.status) {
      case 'sending':
        return <ActivityIndicator size="small" color={Colors.textSecondaryDark} style={{ marginLeft: 4 }} />;
      case 'failed':
        return <AlertCircle size={12} color={Colors.error} style={{ marginLeft: 4 }} />;
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
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: isLastInGroup ? 8 : 2,
        paddingHorizontal: 16,
        justifyContent: isFromCurrentUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isFromCurrentUser ? (
        showAvatar ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              overflow: 'hidden',
              marginRight: 8,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Image
              source={
                isFromProvider
                  ? require('../../assets/images/plumbericon2.png')
                  : require('../../assets/images/userimg.jpg')
              }
              style={{ width: 28, height: 28, borderRadius: 14 }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={{ width: 28, marginRight: 8 }} />
        )
      ) : null}

      <TouchableOpacity
        style={{
          maxWidth: '78%',
          alignItems: isFromCurrentUser ? 'flex-end' : 'flex-start',
        }}
        activeOpacity={message.status === 'failed' && isFromCurrentUser ? 0.7 : 1}
        onPress={message.status === 'failed' && isFromCurrentUser ? onRetry : undefined}
        onLongPress={onLongPress}
      >
        <View
          style={{
            backgroundColor: isFromCurrentUser ? Colors.accent : Colors.white,
            borderRadius: 18,
            borderTopLeftRadius: isFromCurrentUser ? 18 : isFirstInGroup ? 18 : 12,
            borderTopRightRadius: isFromCurrentUser ? (isFirstInGroup ? 18 : 12) : 18,
            borderBottomLeftRadius: isFromCurrentUser ? 18 : isLastInGroup ? 5 : 12,
            borderBottomRightRadius: isFromCurrentUser ? (isLastInGroup ? 5 : 12) : 18,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderWidth: isFromCurrentUser ? 0 : 1,
            borderColor: 'rgba(17, 24, 39, 0.045)',
            ...iosOnlyShadow({
              shadowColor: Colors.surfaceDark,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isFromCurrentUser ? 0.04 : 0.03,
              shadowRadius: 3,
            }),
            elevation: androidElevation(isFromCurrentUser ? 0 : 1),
          }}
        >
          <Text
            style={{
              fontSize: 14.5,
              fontFamily: 'Poppins-Regular',
              color: isFromCurrentUser ? Colors.white : Colors.textPrimary,
              lineHeight: 19,
            }}
          >
            {message.text}
          </Text>
        </View>

        {showMeta ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 2,
              paddingHorizontal: 2,
              justifyContent: isFromCurrentUser ? 'flex-end' : 'flex-start',
            }}
          >
            <Text style={{ fontSize: 10, fontFamily: 'Poppins-Regular', color: '#9AA19A' }}>
              {message.time}
            </Text>
            {getStatusIcon()}
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}
