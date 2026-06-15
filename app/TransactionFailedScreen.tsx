import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, Spacing, SHADOWS } from '@/lib/designSystem';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User, XCircle } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, Image } from 'react-native';
import { Button } from '@/components/ui/Button';
import { haptics } from '@/hooks/useHaptics';

export default function TransactionFailedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId?: string;
    amount?: string;
    providerName?: string;
    serviceFee?: string;
    platformFee?: string;
    totalAmount?: string;
    paymentMethod?: string;
    initiatedDate?: string;
  }>();

  const transactionData = {
    transactionId: params.transactionId || 'TXN-2024-001547',
    totalPayment: params.amount || '125,000',
    initiatedDate: params.initiatedDate || 'May 2025',
    providerName: params.providerName || "John's Plumbing",
    serviceFee: params.serviceFee || '450.00',
    platformFee: params.platformFee || '25.00',
    totalAmount: params.totalAmount || '485.00',
    paymentMethod: params.paymentMethod || '**** **** **** 4532',
  };

  const failureReasons = [
    'Insufficient wallet balance',
    'Payment failed due to poor network',
    'Bank declined the transaction',
    'Provider unavailable',
    'Payment verification not completed',
  ];

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Transaction Failed" onBack={() => router.back()} backgroundColor={Colors.white} />
        {/* Main Transaction Card */}
        <View
          style={{
            backgroundColor: Colors.white,
            marginHorizontal: Spacing.lg,
            marginTop: Spacing.lg,
            borderRadius: BorderRadius.xl,
            padding: Spacing.xl,
            ...SHADOWS.md,
          }}
        >
          {/* Total Payment Section */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
                marginBottom: Spacing.xs,
              }}
            >
              Total Payment
            </Text>
            <Text
              style={{
                fontSize: 36,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: Spacing.xs,
              }}
            >
              ${transactionData.totalPayment}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
              }}
            >
              Initiated on {transactionData.initiatedDate}
            </Text>
          </View>

          {/* Service Provider Section */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: Spacing.xl,
              paddingBottom: Spacing.xl,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: Colors.textPrimary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.md,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#3B82F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={20} color={Colors.white} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  marginBottom: 2,
                }}
              >
                {transactionData.providerName}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Service Provider
              </Text>
            </View>
          </View>

          {/* Transaction Breakdown */}
          <View style={{ marginBottom: Spacing.lg }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Service Fee
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textPrimary,
                }}
              >
                ${transactionData.serviceFee}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Platform Fee
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textPrimary,
                }}
              >
                ${transactionData.platformFee}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: Spacing.md,
                paddingTop: Spacing.md,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                }}
              >
                Total Amount
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                }}
              >
                ${transactionData.totalAmount}
              </Text>
            </View>
          </View>

          {/* Payment Method */}
          <View
            style={{
              marginBottom: Spacing.md,
              paddingBottom: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
                marginBottom: Spacing.xs,
              }}
            >
              Payment Method
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
              }}
            >
              {transactionData.paymentMethod}
            </Text>
          </View>

          {/* Transaction ID */}
          <View>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
                marginBottom: Spacing.xs,
              }}
            >
              Transaction ID
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
              }}
            >
              {transactionData.transactionId}
            </Text>
          </View>
        </View>

        {/* Reasons Section */}
        <View
          style={{
            marginHorizontal: Spacing.lg,
            marginTop: Spacing.xl,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: Spacing.sm,
            }}
          >
            Reasons
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: Spacing.lg,
              lineHeight: 20,
            }}
          >
            Here are a few reasons why your transaction failed.
          </Text>

          {/* Reasons List */}
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.lg,
              padding: Spacing.lg,
              ...SHADOWS.sm,
            }}
          >
            {failureReasons.map((reason, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginBottom: index < failureReasons.length - 1 ? Spacing.md : 0,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: Colors.errorBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: Spacing.sm,
                    marginTop: 2,
                  }}
                >
                  <XCircle size={14} color={Colors.errorBright} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                    lineHeight: 20,
                  }}
                >
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View
          style={{
            marginHorizontal: Spacing.lg,
            marginTop: Spacing.xl,
            gap: Spacing.md,
          }}
        >
          <Button
            title="Try Again"
            onPress={() => {
              haptics.light();
              // Navigate back to payment screen or retry payment
              router.back();
            }}
            variant="primary"
            size="large"
          />
          <Button
            title="Contact Support"
            onPress={() => {
              haptics.light();
              router.push('/SupportScreen' as any);
            }}
            variant="secondary"
            size="large"
          />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
