import { BorderRadius, Colors } from '@/lib/designSystem';
import { providerHomeSurface } from '@/lib/providerSurfaceStyles';
import { truncateMiddle } from '@/utils/formatReference';
import { CheckCircle, Clock, Download, Share2, User, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type ClientReceiptStatus = 'completed' | 'pending' | 'failed';

export type ClientReceiptData = {
  transactionId: string;
  reference?: string;
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
  status?: ClientReceiptStatus;
  /** Shown under “Failed” when provided (API reason). */
  failureReason?: string;
};

type ClientPaymentReceiptProps = {
  data: ClientReceiptData;
  onShare: () => void;
  onDownload: () => void;
  onViewJob?: () => void;
  showViewJob?: boolean;
};

function ReceiptRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: 'Poppins-Medium',
          color: Colors.textSecondaryDark,
          marginRight: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flexShrink: 1,
          fontSize: emphasize ? 15 : 13,
          fontFamily: emphasize ? 'Poppins-Bold' : 'Poppins-SemiBold',
          color: Colors.textPrimary,
          textAlign: 'right',
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

export function ClientPaymentReceipt({
  data,
  onShare,
  onDownload,
  onViewJob,
  showViewJob = false,
}: ClientPaymentReceiptProps) {
  const status: ClientReceiptStatus = data.status ?? 'completed';

  const referenceDisplay = useMemo(
    () => (data.reference ? truncateMiddle(data.reference) : ''),
    [data.reference],
  );

  const statusPresentation = useMemo(() => {
    switch (status) {
      case 'pending':
        return {
          title: 'Payment pending',
          subtitle: 'We’re still confirming this payment. Check back shortly.',
          iconBg: 'rgba(245, 158, 11, 0.14)',
          Icon: Clock,
          iconColor: Colors.warning,
          badgeBg: Colors.warningBadge ?? 'rgba(245, 158, 11, 0.18)',
          badgeFg: Colors.warningForeground,
          badgeLabel: 'Pending',
          amountLabel: 'Amount',
        };
      case 'failed':
        return {
          title: 'Failed',
          subtitle: '',
          iconBg: Colors.errorBadge ?? 'rgba(239, 68, 68, 0.14)',
          Icon: XCircle,
          iconColor: Colors.errorBright,
          badgeBg: Colors.errorBadge ?? 'rgba(239, 68, 68, 0.14)',
          badgeFg: Colors.errorForeground,
          badgeLabel: 'Failed',
          amountLabel: 'Amount',
        };
      default:
        return {
          title: 'Payment successful',
          subtitle: 'Your wallet payment has been recorded.',
          iconBg: Colors.sageTint,
          Icon: CheckCircle,
          iconColor: Colors.accent,
          badgeBg: Colors.successLight,
          badgeFg: Colors.successForeground,
          badgeLabel: 'Completed',
          amountLabel: 'Total paid',
        };
    }
  }, [status]);

  const { Icon, iconColor, iconBg, title, subtitle, badgeBg, badgeFg, badgeLabel, amountLabel } =
    statusPresentation;

  const heroSubtitle = status === 'failed' ? '' : subtitle;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginBottom: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <Icon size={28} color={iconColor} strokeWidth={2.2} />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontFamily: 'Poppins-Bold',
            color: Colors.textPrimary,
            letterSpacing: -0.3,
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        {heroSubtitle ? (
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              textAlign: 'center',
              lineHeight: 18,
              paddingHorizontal: 8,
            }}
          >
            {heroSubtitle}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          ...providerHomeSurface,
          flex: 1,
          padding: 16,
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 4,
            }}
          >
            {amountLabel}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              letterSpacing: -0.8,
              marginBottom: 4,
            }}
          >
            ₦{data.totalAmount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 16,
            }}
          >
            {data.paymentDate}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#0a0a0a',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <User size={18} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {data.providerName}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
                {data.jobTitle}
              </Text>
            </View>
          </View>

          <ReceiptRow label="Service date" value={data.serviceDate} />
          <ReceiptRow label="Service time" value={data.serviceTime} />
          <ReceiptRow label="Service fee" value={`₦${data.serviceFee}`} />
          <ReceiptRow label="Platform fee" value={`₦${data.platformFee}`} />
          {parseFloat(data.tax) > 0 ? <ReceiptRow label="Tax" value={`₦${data.tax}`} /> : null}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>Total amount</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
              ₦{data.totalAmount}
            </Text>
          </View>
        </View>

        <View>
          <ReceiptRow label="Payment method" value={data.paymentMethod} />
          <ReceiptRow label="Transaction ID" value={data.transactionId} />
          {referenceDisplay ? <ReceiptRow label="Reference" value={referenceDisplay} /> : null}
          {status === 'failed' && data.failureReason?.trim() ? (
            <ReceiptRow label="Reason" value={data.failureReason.trim()} />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark }}>Status</Text>
            <View
              style={{
                backgroundColor: badgeBg,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: BorderRadius.full,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Poppins-SemiBold', color: badgeFg }}>
                {badgeLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ paddingTop: 14 }}>
        {showViewJob && onViewJob ? (
          <TouchableOpacity
            onPress={onViewJob}
            style={{
              backgroundColor: Colors.black,
              borderRadius: BorderRadius.default,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>View job</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
          <TouchableOpacity
            onPress={onDownload}
            style={{
              flex: 1,
              backgroundColor: Colors.accent,
              borderRadius: BorderRadius.default,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.85}
          >
            <Download size={16} color={Colors.white} />
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: Colors.white, marginLeft: 6 }}>
              Download
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShare}
            style={{
              flex: 1,
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.default,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
            }}
            activeOpacity={0.85}
          >
            <Share2 size={16} color={Colors.accent} />
            <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: Colors.accent, marginLeft: 6 }}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
