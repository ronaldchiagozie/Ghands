import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { useRouter } from 'expo-router';

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Privacy Policy" onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {/* Information We Collect */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Information We Collect
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              We collect information you provide during registration, such as your name, email address, phone number, professional details, identification documents, and service information. We also collect financial information required for payouts, such as bank details or wallet accounts. In addition, we collect information automatically when you use the app, including device details, IP address, usage logs, and real-time or background location data for job accuracy and safety.
            </Text>
          </View>

          {/* How We Use Your Information */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              How We Use Your Information
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              We use your information to verify your identity, match you with customers, process service bookings, and deliver secure payments. Your data enables us to personalize your experience, recommend suitable jobs, send important service updates, and provide customer support. We also use your information to monitor safety, prevent fraud, and improve platform performance. Providers may receive notifications for job requests, reminders, promotional campaigns, and policy updates.
            </Text>
          </View>

          {/* How We Share Your Information */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              How We Share Your Information
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              We may share your information with customers once you accept a job, including your name, profile, rating, and location (when applicable). Your information may also be shared with payment processors to handle transactions and with regulatory or law-enforcement authorities when legally required. We do not sell or rent your personal information to third parties. All partners and vendors we work with are required to maintain strict data protection and confidentiality standards.
            </Text>
          </View>

          {/* Your Choices & Rights */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Your Choices & Rights
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              You have the right to access, update, or delete your personal information at any time within the app. You may also modify your communication preferences or choose to restrict certain information from being displayed publicly. However, some information may be required for verification, safety checks, or to maintain your eligibility as a service provider. If you deactivate your account, we may retain some information for legal, regulatory, or security purposes, as permitted by law.
            </Text>
          </View>

          {/* Security Measures */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Security Measures
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              We implement robust security measures to protect your information from unauthorized access, alteration, or disclosure. These include encryption, access controls, and regular security audits. We continuously update our practices to safeguard your data.
            </Text>
          </View>

          {/* Last Updated */}
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Last Updated: October 26, 2024
          </Text>
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
