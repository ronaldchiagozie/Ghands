import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CheckCircle, Download, Lock, Share2, User } from 'lucide-react-native';
import { exitPaymentToJob, navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Share, Alert, Image, ActivityIndicator } from 'react-native';
import { Button } from '@/components/ui/Button';
import { serviceRequestService, providerService } from '@/services/api';

// Helper function to format dates
const formatDate = (date: Date, format: string = 'MMM dd, yyyy'): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  if (format.includes('MMMM')) {
    return format
      .replace('MMMM', fullMonths[month])
      .replace('dd', day.toString().padStart(2, '0'))
      .replace('yyyy', year.toString())
      .replace('MMM', months[month])
      .replace('MM', (month + 1).toString().padStart(2, '0'))
      .replace('h:mm a', `${displayHours}:${displayMinutes} ${period}`);
  }
  
  return format
    .replace('MMM', months[month])
    .replace('MM', (month + 1).toString().padStart(2, '0'))
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('yyyy', year.toString())
    .replace('h:mm a', `${displayHours}:${displayMinutes} ${period}`);
};

interface TransactionData {
  transactionId: string;
  jobTitle: string;
  providerName: string;
  serviceDate: string;
  serviceTime: string;
  serviceFee: string;
  platformFee: string;
  tax: string;
  totalAmount: string;
  paymentMethod: string;
  paymentDate: string;
}

const parseMoneyValue = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export default function PaymentSuccessfulScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId?: string;
    providerName?: string;
    serviceName?: string;
    requestId?: string;
    amount?: string;
    quotationId?: string;
  }>();
  
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleExit = useCallback(() => {
    if (params.requestId) {
      exitPaymentToJob(router, params.requestId);
      return;
    }
    navigateBack(router, NAV_FALLBACK.clientJobs);
  }, [params.requestId, router]);

  // Load transaction data from API
  const loadTransactionData = useCallback(async () => {
    if (!params.requestId) {
      // Use params if available, otherwise use defaults
      const routeAmount = parseMoneyValue(params.amount);
      const data: TransactionData = {
        transactionId: params.transactionId || `TXN-${Date.now()}`,
        jobTitle: params.serviceName || 'Service',
        providerName: params.providerName || 'Provider',
        serviceDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        serviceTime: 'N/A',
        serviceFee: routeAmount.toFixed(2),
        platformFee: '0.00',
        tax: '10.00',
        totalAmount: routeAmount.toFixed(2),
        paymentMethod: 'Wallet',
        paymentDate: formatDate(new Date(), 'MMM dd, yyyy \'at\' h:mm a'),
      };
      setTransactionData(data);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const requestId = parseInt(params.requestId, 10);
      if (isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }

      // Request details often fail right after wallet pay (404/500) — route params still hold a valid receipt.
      const [request, quotations] = await Promise.all([
        serviceRequestService.getRequestDetails(requestId).catch(() => null),
        serviceRequestService.getQuotations(requestId).catch(() => []),
      ]);

      const quotation = quotations.find((q: any) => q.status === 'accepted') || quotations[0] || null;

      const laborCost = quotation?.laborCost || 0;
      const logisticsCost = quotation?.logisticsCost || 0;
      const materialsCost =
        quotation?.materials?.reduce(
          (sum: number, mat: any) => sum + (mat.unitPrice || 0) * (mat.quantity || 0),
          0
        ) || 0;
      const lineServiceFee = laborCost + logisticsCost + materialsCost;
      const routeAmount = parseMoneyValue(params.amount);
      const serviceFeeNum =
        lineServiceFee > 0 ? lineServiceFee : routeAmount;
      const platformFee = quotation?.serviceCharge || 0;
      const tax = quotation?.tax ?? 10;
      const qTotal = quotation?.total;
      const totalAmountNum =
        qTotal != null && parseMoneyValue(qTotal) > 0 ? parseMoneyValue(qTotal) : routeAmount;

      let serviceDate: string;
      let serviceTime: string;
      if (request) {
        serviceDate = request.scheduledDate
          ? formatDate(new Date(request.scheduledDate), 'MMMM dd, yyyy')
          : request.createdAt
            ? formatDate(new Date(request.createdAt), 'MMMM dd, yyyy')
            : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        serviceTime = request.scheduledTime || 'N/A';
      } else {
        if (__DEV__) {
          console.warn(
            '[PaymentSuccessful] getRequestDetails unavailable; receipt from params' +
              (quotation ? ' + quotation' : '')
          );
        }
        serviceDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        serviceTime = 'N/A';
      }

      const acceptedAt = (quotation as any)?.acceptedAt;
      const paymentDate = acceptedAt
        ? formatDate(new Date(acceptedAt), 'MMM dd, yyyy \'at\' h:mm a')
        : formatDate(new Date(), 'MMM dd, yyyy \'at\' h:mm a');

      const data: TransactionData = {
        transactionId: params.transactionId || `TXN-${requestId}-${Date.now().toString().slice(-6)}`,
        jobTitle:
          (request && (request.jobTitle || request.description)) ||
          params.serviceName ||
          'Service Request',
        providerName: quotation?.provider?.name || params.providerName || 'Provider',
        serviceDate,
        serviceTime,
        serviceFee: serviceFeeNum.toFixed(2),
        platformFee: platformFee.toFixed(2),
        tax: (typeof tax === 'number' ? tax : parseFloat(String(tax)) || 0).toFixed(2),
        totalAmount: totalAmountNum.toFixed(2),
        paymentMethod: 'Wallet',
        paymentDate,
      };

      setTransactionData(data);
    } catch (error: any) {
      if (__DEV__) {
        console.warn('[PaymentSuccessful] Unexpected error, using route params only', error);
      }
      const routeAmount = parseMoneyValue(params.amount);
      const data: TransactionData = {
        transactionId: params.transactionId || `TXN-${Date.now()}`,
        jobTitle: params.serviceName || 'Service',
        providerName: params.providerName || 'Provider',
        serviceDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        serviceTime: 'N/A',
        serviceFee: routeAmount.toFixed(2),
        platformFee: '0.00',
        tax: '10.00',
        totalAmount: routeAmount.toFixed(2),
        paymentMethod: 'Wallet',
        paymentDate: formatDate(new Date(), 'MMM dd, yyyy \'at\' h:mm a'),
      };
      setTransactionData(data);
    } finally {
      setIsLoading(false);
    }
  }, [params.requestId, params.transactionId, params.providerName, params.serviceName, params.amount]);

  useEffect(() => {
    loadTransactionData();
  }, [loadTransactionData]);

  const handleDownloadReceipt = () => {
    // Handle PDF download
    Alert.alert('Download', 'Receipt will be downloaded shortly.');
  };

  const handleShareReceipt = async () => {
    if (!transactionData) {
      Alert.alert('Error', 'Transaction data not available');
      return;
    }
    try {
      await Share.share({
        message: `Payment Receipt\nTransaction ID: ${transactionData.transactionId}\nAmount: ₦${transactionData.totalAmount}`,
        title: 'Payment Receipt',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  if (isLoading || !transactionData) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: Colors.sageTint,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
          <Text style={{ fontSize: 16, fontFamily: 'Poppins-Bold', color: Colors.textPrimary, textAlign: 'center' }}>
            Preparing payment receipt
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 19, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, textAlign: 'center' }}>
            We&apos;re confirming the payment details and receipt reference.
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="" onBack={handleExit} backgroundColor={Colors.backgroundLight} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
      >
        {/* App Branding Section */}
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            paddingVertical: 10,
          }}
        >
          <Image
            source={require('@/assets/images/icon.png')}
            style={{
              width: 80,
              height: 80,
              marginBottom: 16,
            }}
            resizeMode="contain"
          />
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 6,
              letterSpacing: -0.3,
            }}
          >
            G-Hands
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
            }}
          >
            Secure service payment
          </Text>
        </View>
        {/* Payment Successful Card */}
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: Colors.sageTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CheckCircle size={32} color={Colors.accent} />
            </View>
            <Text
              style={{
                fontSize: 19,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 6,
                letterSpacing: -0.3,
              }}
            >
              Payment Successful
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
              }}
            >
              Your wallet payment has been processed and recorded.
            </Text>
            <View
              style={{
                marginTop: 18,
                alignSelf: 'stretch',
                backgroundColor: '#0a0a0a',
                borderRadius: 18,
                paddingVertical: 16,
                paddingHorizontal: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: 'rgba(255,255,255,0.66)', letterSpacing: 0.7, textTransform: 'uppercase' }}>
                Total paid
              </Text>
              <Text style={{ marginTop: 4, fontSize: 30, lineHeight: 38, fontFamily: 'Poppins-Bold', color: Colors.white, letterSpacing: -0.9 }}>
                ₦{transactionData.totalAmount}
              </Text>
            </View>
          </View>

          {/* Service Details */}
          <View
            style={{
              paddingTop: 20,
              borderTopWidth: 1,
              borderTopColor: 'rgba(17, 24, 39, 0.05)',
            }}
          >
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                  marginBottom: 4,
                }}
              >
                Job Title
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                {transactionData.jobTitle}
              </Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                  marginBottom: 4,
                }}
              >
                Service Provider
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                {transactionData.providerName}
              </Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                  marginBottom: 4,
                }}
              >
                Service Date
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                {transactionData.serviceDate}
              </Text>
            </View>
            <View>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                  marginBottom: 4,
                }}
              >
                Service Time
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                {transactionData.serviceTime}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Details Card */}
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Payment Details
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Service Fee
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              ₦{transactionData.serviceFee}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Platform Fee
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              ₦{transactionData.platformFee}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Tax (8%)
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              ₦{transactionData.tax}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(17, 24, 39, 0.08)',
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontFamily: 'Poppins-Bold',
                color: Colors.accent,
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
              ₦{transactionData.totalAmount}
            </Text>
          </View>
        </View>

        {/* Transaction Information Card */}
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Transaction Information
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Payment Method
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {transactionData.paymentMethod}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Transaction ID
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {transactionData.transactionId}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Payment Date
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              {transactionData.paymentDate}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Status
            </Text>
            <View
              style={{
                backgroundColor: '#ECFDF3',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: '#047857',
                }}
              >
                Completed
              </Text>
            </View>
          </View>
        </View>

        {params.requestId ? (
          <TouchableOpacity
            onPress={handleExit}
            style={{
              backgroundColor: Colors.black,
              borderRadius: BorderRadius.default,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.white,
                marginRight: 8,
              }}
            >
              View job
            </Text>
            <ArrowRight size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : null}

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={handleDownloadReceipt}
            style={{
              flex: 1,
              backgroundColor: Colors.accent,
              borderRadius: BorderRadius.default,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Download size={18} color={Colors.white} />
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.white,
                marginLeft: 8,
              }}
            >
              Download PDF Receipt
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShareReceipt}
            style={{
              flex: 1,
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.default,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
            }}
            activeOpacity={0.8}
          >
            <Share2 size={18} color={Colors.accent} />
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.accent,
                marginLeft: 8,
              }}
            >
              Share Receipt
            </Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View
          style={{
            backgroundColor: Colors.backgroundGray,
            borderRadius: BorderRadius.lg,
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Need help with this transaction?
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/SupportScreen' as any)}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.accent,
              }}
            >
              Contact Support
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

