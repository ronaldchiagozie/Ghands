import { Colors } from '@/lib/designSystem';
import { ActivityIndicator, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import React from 'react';

const ICON_WELL = {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: Colors.successLight,
  borderWidth: 1,
  borderColor: 'rgba(79, 103, 57, 0.12)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export function ChatThreadLoadingState() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F7F8F5',
        paddingHorizontal: 32,
      }}
    >
      <View style={{ ...ICON_WELL, marginBottom: 12 }}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
      <Text
        style={{
          fontSize: 15,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.textPrimary,
          marginBottom: 4,
        }}
      >
        Loading messages
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-Regular',
          color: Colors.textSecondaryDark,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        Fetching your conversation…
      </Text>
    </View>
  );
}

type ChatThreadEmptyStateProps = {
  peerName: string;
};

export function ChatThreadEmptyState({ peerName }: ChatThreadEmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 48,
      }}
    >
      <View style={{ ...ICON_WELL, marginBottom: 14 }}>
        <MessageCircle size={22} color={Colors.accent} strokeWidth={2} />
      </View>
      <Text
        style={{
          fontSize: 16,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.textPrimary,
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        No messages yet
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Poppins-Regular',
          color: Colors.textSecondaryDark,
          lineHeight: 20,
          textAlign: 'center',
        }}
      >
        Say hello to {peerName}. You can ask about timing, access, or job details.
      </Text>
    </View>
  );
}
