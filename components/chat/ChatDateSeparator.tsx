import React from 'react';
import { Text, View } from 'react-native';

type ChatDateSeparatorProps = {
  label: string;
};

export default function ChatDateSeparator({ label }: ChatDateSeparatorProps) {
  return (
    <View
      style={{
        alignSelf: 'center',
        backgroundColor: '#E9EEE0',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginVertical: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: 'Poppins-Medium', color: '#64705A' }}>{label}</Text>
    </View>
  );
}
