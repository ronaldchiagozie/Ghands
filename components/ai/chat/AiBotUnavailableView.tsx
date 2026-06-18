import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

const AI_BOT_SAD = require('../../../ghansdsaibotnothappy.png');

export default function AiBotUnavailableView() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      <Image
        source={AI_BOT_SAD}
        contentFit="contain"
        style={{ width: 200, height: 200, marginBottom: 24 }}
        accessibilityLabel="AI assistant unavailable"
      />
      <Text
        style={{
          fontFamily: 'Poppins-Bold',
          fontSize: 22,
          color: '#111827',
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        Bot Unavailable!!
      </Text>
      <Text
        style={{
          fontFamily: 'Poppins-Regular',
          fontSize: 14,
          lineHeight: 22,
          color: 'rgba(17, 24, 39, 0.78)',
          textAlign: 'center',
        }}
      >
        We are working on making Handy better for you. We'll be back soon!
      </Text>
    </View>
  );
}
