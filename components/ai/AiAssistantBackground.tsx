import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AI_ASSISTANT_GRADIENT, AI_ASSISTANT_OVERLAY } from './aiAssistantTheme';

export default function AiAssistantBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...AI_ASSISTANT_GRADIENT.colors]}
        locations={[...AI_ASSISTANT_GRADIENT.locations]}
        start={AI_ASSISTANT_GRADIENT.start}
        end={AI_ASSISTANT_GRADIENT.end}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: AI_ASSISTANT_OVERLAY }]} />
    </View>
  );
}
