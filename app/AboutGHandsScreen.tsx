import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { useRouter } from 'expo-router';

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function AboutGHandsScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="About G-Hands" onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {/* G-Hands Section */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 24,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 8,
              }}
            >
              G-Hands
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginBottom: 16,
              }}
            >
              Version 1.2.3
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              G-Hands is a trusted platform connecting clients with skilled service providers for home and business tasks. We utilize a secure escrow-based payment system to ensure fair transactions. Our mission is to make reliable services accessible and transparent for everyone, regardless of technical background.
            </Text>
          </View>

          {/* Our Mission Section */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Our Mission
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              To empower individuals and businesses by providing a seamless and secure way to find and hire skilled professionals for any task, fostering trust and transparency in every interaction.
            </Text>
          </View>

          {/* Our Values Section */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Our Values
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              Integrity, transparency, and reliability are at the core of everything we do. We are committed to building a community where clients and service providers can connect with confidence, knowing that their needs are met with professionalism and fairness.
            </Text>
          </View>

          {/* Contact Information Section */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Contact Information
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              For any inquiries or support, please reach out to us at support@ghands.com or call us at (555) 123-4567. We are here to assist you with any questions or concerns you may have.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
