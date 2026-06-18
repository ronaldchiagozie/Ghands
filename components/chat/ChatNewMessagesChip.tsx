import { haptics } from '@/hooks/useHaptics';
import { androidElevation, iosOnlyShadow } from '@/lib/surfaceStyles';
import { ChevronDown } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

type ChatNewMessagesChipProps = {
  count: number;
  onPress: () => void;
  bottomOffset: number;
};

export default function ChatNewMessagesChip({ count, onPress, bottomOffset }: ChatNewMessagesChipProps) {
  if (count <= 0) return null;

  const label = count === 1 ? 'New message' : `${count} new messages`;

  return (
    <TouchableOpacity
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Scroll to ${label}`}
      style={{
        position: 'absolute',
        alignSelf: 'center',
        bottom: bottomOffset + 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        ...iosOnlyShadow({
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
        }),
        elevation: androidElevation(1),
        zIndex: 20,
      }}
    >
      <ChevronDown size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
      <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#FFFFFF' }}>{label}</Text>
    </TouchableOpacity>
  );
}
