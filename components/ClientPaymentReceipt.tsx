import { BorderRadius, Colors } from '@/lib/designSystem';
import { providerHomeSurface } from '@/lib/providerSurfaceStyles';
import { truncateMiddle } from '@/utils/formatReference';
import { CheckCircle, Clock, Download, Share2, User, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import ToolPattern from '@/components/ToolPattern';

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
  /**
   * True for the instant the card is being captured to an image.
   *
   * The buttons are controls, not part of the document - a receipt arriving in
   * somebody's chat with a Download button printed on it is obviously a
   * screenshot of an app rather than a record of a payment. They come out for
   * the capture, and the brand mark takes their place so the image is signed
   * instead of simply cropped.
   */
  capturing?: boolean;
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
  capturing = false,
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
    <View>
      {/**
        * The hero comes out of the capture too.
        *
        * The circle, the "Payment successful" and its line underneath are this
        * screen greeting the person who just paid. A shared receipt is read by
        * somebody else entirely - a landlord, an employer - and congratulating
        * them on a payment they did not make is the app talking to the wrong
        * reader. What travels is the white card: the amount, the provider, the
        * date, the reference, and the name at the bottom.
        */}
      {capturing ? null : (
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

      )}

      <View
        style={{
          ...providerHomeSurface,
          padding: 16,
          /** Holds the pattern inside the card's corners. */
          overflow: 'hidden',
        }}
      >
        {/**
          * A receipt is the one screen that leaves the app - somebody sends it
          * to a landlord, an employer, whoever paid for the work. A bare white
          * card of numbers says nothing about who produced it.
          *
          * Very faint on purpose. This sits behind money, and anything strong
          * enough to be read as a picture is strong enough to interfere with a
          * figure somebody is checking.
          */}
        <ToolPattern color={Colors.accent} opacity={0.055} tile={190} />

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

        {/**
          * Signed, the way a bank's receipt is. Somebody forwarding this to a
          * landlord is asking them to believe it, and an unsigned slab of text
          * gives them nothing to believe - the name is what turns a screenshot
          * into a record of who issued it.
          */}
        {capturing ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 18, height: 18, borderRadius: 4 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Bold',
                color: Colors.accent,
                letterSpacing: -0.2,
              }}
            >
              GHands
            </Text>
            <Text style={{ fontSize: 11.5, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}>
              · ghand.com.ng
            </Text>
          </View>
        ) : (
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
        )}
      </View>
    </View>
  );
}
