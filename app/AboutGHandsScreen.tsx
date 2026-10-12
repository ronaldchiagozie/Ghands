import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import Constants from 'expo-constants';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function AboutGHandsScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="About GHands" onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)} backgroundColor={Colors.white} />
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
              GHands
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                marginBottom: 16,
              }}
            >
              {/**
                * The real version, not a number typed into this file. It said
                * 1.2.3 while the app shipped as 1.0.3 - and a support call
                * that starts with the wrong version number is a support call
                * that starts in the wrong place.
                */}
              Version {Constants.expoConfig?.version ?? '—'}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              {/**
                * What the app does, in the terms the app actually works in.
                * This read as a press release - "trusted platform", "we
                * utilize", "regardless of technical background" - which is
                * the register nobody writes in and everybody skims.
                */}
              GHands connects you with vetted tradespeople for work at home or at
              your business. You describe the job, choose a provider nearby, and
              pay through the app. Payment is held until the work is done.
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
              Why we built it
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              Hiring a tradesperson should not depend on who you happen to know.
              GHands exists so that finding one, agreeing a price and paying for
              the work are all the same five minutes.
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
              How it works for you
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              Every provider on GHands is identity-checked before they can take
              work. Prices are quoted before anyone starts. Your money stays with
              us until you confirm the job is done, and disputes are reviewed by
              a person.
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
