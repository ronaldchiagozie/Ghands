import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { useRouter } from 'expo-router';

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Terms of Service" onBack={() => router.back()} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {/* Terms Content */}
          <View
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
                lineHeight: 22,
              }}
            >
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Information Accuracy:</Text> Providers must submit accurate and truthful information during registration and verification. Incorrect or misleading information can lead to delays, suspension, or removal from the platform.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Compliance:</Text> Providers must comply with local laws, safety regulations, and professional standards.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Service Delivery:</Text> Once a provider accepts a job or submits a quotation approved by the customer, they are responsible for delivering the service as agreed and on time.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Payments:</Text> Payments for completed services are processed securely. Funds may be held temporarily for verification, dispute resolution, or security checks before becoming available in the provider&apos;s wallet.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Cancellations:</Text> Cancellations initiated by providers may affect their ratings and lead to temporary restrictions based on severity or frequency.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Job Review:</Text> Providers are strongly encouraged to review job details before accepting or submitting a quotation.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Disputes:</Text> Disputes must be reported within 48 hours of service completion. The platform may request supporting evidence, including photos, communication logs, or proof of work.{'\n\n'}
              
              <Text style={{ fontFamily: 'Poppins-Bold' }}>Fraudulent:</Text> Any fraudulent activity, including but not limited to fake reviews, payment fraud, or misrepresentation of services, will result in immediate account suspension and potential legal action.
            </Text>
          </View>

          {/* Last Updated */}
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Last Updated: December 2, 2024
          </Text>
        </ScrollView>

        {/* Footer Button */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 32,
            paddingTop: 16,
            backgroundColor: Colors.white,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              router.back();
            }}
            style={{
              backgroundColor: '#D8FF2E',
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
              }}
            >
              Agree & Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
