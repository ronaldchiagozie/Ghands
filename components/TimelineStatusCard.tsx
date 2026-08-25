import { ChevronDown, ChevronUp, MessageCircleMore } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import { AvatarCircle } from '@/components/AvatarCircle';
import { pickProviderImageUriFromRecord } from '@/utils/clientProfilePhoto';

import { haptics } from '@/hooks/useHaptics';
import { Colors } from '@/lib/designSystem';
import { buildChatScreenParams } from '@/utils/navigation';
import type { QuotationWithProvider, ServiceRequest } from '@/services/api';

type TimelineHeaderData = {
  title: string;
  subtitle?: string;
  statusPill?: string;
  pillBg?: string;
  pillText?: string;
  timestamp?: string | null;
  provider?: any;
  showPayButton?: boolean;
  payAmount?: number;
  acceptedQuotation?: any;
  // Visit logistics (inspection fee) UI
  showVisitPayButton?: boolean;
  showDeclineVisitButton?: boolean;
  visitLogisticsCost?: number;
  onVisitPay?: () => void;
  onVisitDecline?: () => void;
};

type MappedProviderSummary = {
  providerId: number;
  distanceKm?: number;
  minutesAway?: number;
};

type ClientIdentity = {
  /** Shown next to avatar when no provider is assigned yet (e.g. waiting for providers). */
  displayName?: string;
  imageUri?: string | null;
};

type TimelineStatusCardProps = {
  header: TimelineHeaderData;
  quotations: QuotationWithProvider[] | any[];
  acceptedProviders: any[];
  mappedProviders: MappedProviderSummary[];
  request: ServiceRequest | null;
  requestId?: string | string[];
  /** Logged-in client — used for avatar row when `header.provider` is missing. */
  clientIdentity?: ClientIdentity | null;
  /** Switch to Quotations tab from Updates when a quote is ready. */
  onViewQuotations?: () => void;
};

const TimelineStatusCardComponent = ({
  header,
  quotations,
  acceptedProviders,
  mappedProviders,
  request,
  requestId,
  clientIdentity,
  onViewQuotations,
}: TimelineStatusCardProps) => {
  const router = useRouter();
  const [detailsExpanded, setDetailsExpanded] = useState(() => Boolean(header.subtitle));

  const { isQuotationReceived, isQuotationPending } = useMemo(() => {
    const qList = Array.isArray(quotations) ? quotations : [];
    const hasQ = qList.some((q: any) => {
      if (!q || typeof q !== 'object') return false;
      if (q.sentAt || q.submittedAt) return true;
      if (q.status && q.status !== 'draft') return true;
      if (q.total != null && q.total > 0) return true;
      return false;
    });

    const isQuotationPendingValue = (acceptedProviders?.length || 0) > 0 && !hasQ;

    return {
      isQuotationReceived: (header as any).title === 'Quotation received' && hasQ,
      isQuotationPending: isQuotationPendingValue,
    };
  }, [quotations, acceptedProviders, header]);

  if (!header) {
    return null;
  }

  const provider = (header as any).provider;
  const pillBg = (header as any).pillBg ?? (provider ? Colors.statusPendingAltBg : Colors.backgroundGray);
  const pillText = (header as any).pillText ?? (provider ? Colors.warningForeground : Colors.iconMuted);
  const statusPill =
    (header as any).statusPill ?? (provider ? 'Provider accepted' : 'Pending');
  const rawProviderName = String(provider?.name || '').trim();
  const providerName =
    !rawProviderName || rawProviderName.toLowerCase() === 'professional service provider'
      ? 'Provider'
      : rawProviderName;
  const visitLogisticsCost = (header as any).visitLogisticsCost;
  const hasVisitFee =
    typeof visitLogisticsCost === 'number' &&
    Number.isFinite(visitLogisticsCost) &&
    visitLogisticsCost > 0;

  const normalizedRequestId =
    typeof requestId === 'string' ? requestId : requestId?.[0];

  const handlePressProvider = () => {
    if (!provider) return;
    haptics.light();
    router.push({
      pathname: '/ProviderDetailScreen',
      params: {
        providerName: provider?.name,
        providerId: provider?.id?.toString(),
      },
    } as any);
  };

  const handlePressChat = () => {
    if (!provider || !normalizedRequestId) return;
    haptics.light();
    router.push({
      pathname: '/ChatScreen',
      params: buildChatScreenParams({
        providerName: provider?.name,
        providerId: provider?.id?.toString(),
        requestId: normalizedRequestId,
        fromJobHub: true,
      }),
    } as any);
  };

  const handlePressPay = () => {
    if (!(header as any).showPayButton || !(header as any).payAmount || !(header as any).acceptedQuotation) {
      return;
    }
    haptics.light();
    const quote = (header as any).acceptedQuotation;
    router.push({
      pathname: '/ConfirmWalletPaymentScreen' as any,
      params: {
        requestId: normalizedRequestId,
        amount: String((header as any).payAmount),
        quotationId: quote?.id?.toString(),
        providerName: quote?.provider?.name || 'Service Provider',
        serviceName: request?.jobTitle || 'Service Request',
        paymentType: 'service' as const,
      },
    } as any);
  };

  const providerSummary =
    provider &&
    (mappedProviders.find(m => m.providerId === provider.id) ?? mappedProviders[0]);

  return (
    <View
      style={{
        marginBottom: isQuotationPending ? 8 : 18,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        overflow: 'hidden',
      }}
    >
      <View className="px-4 pt-4 pb-1">
        {provider ? (
          <View className="flex-row items-start">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePressProvider}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <AvatarCircle
                uri={pickProviderImageUriFromRecord(provider)}
                size={44}
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text
                  className="text-black mb-0.5"
                  style={{ fontFamily: 'Poppins-Bold', fontSize: 15, lineHeight: 20 }}
                  numberOfLines={2}
                >
                  {providerName}
                </Text>
                {providerSummary?.distanceKm != null && (
                  <Text
                    className="text-gray-400"
                    style={{ fontFamily: 'Poppins-Regular', fontSize: 11, lineHeight: 15 }}
                  >
                    {providerSummary.distanceKm.toFixed(1)} km away • ~
                    {providerSummary.minutesAway} min
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={handlePressChat}>
              <MessageCircleMore size={20} color={Colors.iconMuted} />
            </TouchableOpacity>
            <View
              style={{
                backgroundColor: pillBg,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-SemiBold',
                  color: pillText,
                }}
              >
                {statusPill}
              </Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center">
            <AvatarCircle uri={clientIdentity?.imageUri} size={48} style={{ marginRight: 12 }} />
            <View className="flex-1 mr-2" style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text
                className="text-base text-black"
                style={{ fontFamily: 'Poppins-Bold' }}
                numberOfLines={1}
              >
                {clientIdentity?.displayName?.trim() || 'You'}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'Poppins-Regular' }}>
                Your request
              </Text>
            </View>
            <View
              style={{
                backgroundColor: pillBg,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: pillText,
                }}
              >
                {statusPill}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View className="px-4 mt-1 mb-4">
        <View
          style={{
            backgroundColor: '#EEF0F3',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Subtle premium accent overlay (keeps gray-200 base) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -20,
              left: -60,
              width: 140,
              height: 80,
              backgroundColor: Colors.accent,
              opacity: 0.12,
              transform: [{ rotate: '8deg' }],
            }}
          />

          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                haptics.selection();
                setDetailsExpanded((current) => !current);
              }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  lineHeight: 21,
                }}
              >
                {header.title}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.iconMuted,
                  }}
                >
                  Details
                </Text>
                {detailsExpanded ? (
                  <ChevronUp size={14} color={Colors.iconMuted} />
                ) : (
                  <ChevronDown size={14} color={Colors.iconMuted} />
                )}
              </View>
            </TouchableOpacity>
            {header.subtitle && detailsExpanded ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: '#374151',
                  lineHeight: 18,
                  marginTop: 7,
                }}
              >
                {header.subtitle}
              </Text>
            ) : null}
            {(header as any).timestamp && detailsExpanded ? (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.iconMuted,
                  marginTop: 7,
                }}
              >
                {(header as any).timestamp}
              </Text>
            ) : null}

          {isQuotationReceived && onViewQuotations ? (
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onViewQuotations}
                style={{
                  backgroundColor: Colors.accent,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignSelf: 'stretch',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.white,
                    textAlign: 'center',
                  }}
                >
                  Review quotation
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {(header as any).showVisitPayButton && hasVisitFee ? (
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => (header as any).onVisitPay?.()}
                style={{
                  backgroundColor: Colors.accent,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignSelf: 'stretch',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.white,
                    textAlign: 'center',
                  }}
                >
                  Pay visit fee • ₦
                  {visitLogisticsCost.toLocaleString('en-NG', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {(header as any).showDeclineVisitButton && (header as any).onVisitDecline ? (
            <View style={{ marginTop: (header as any).showVisitPayButton && hasVisitFee ? 10 : 12 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => (header as any).onVisitDecline?.()}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignSelf: 'stretch',
                  backgroundColor: Colors.error,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.white,
                    textAlign: 'center',
                  }}
                >
                  Decline visit
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {(header as any).showPayButton && (header as any).payAmount > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePressPay}
              style={{
                marginTop: 14,
                backgroundColor: Colors.accent,
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 10,
                alignSelf: 'flex-start',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                }}
              >
                Pay Now (₦
                {(((header as any).payAmount || 0) as number).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                )
              </Text>
            </TouchableOpacity>
          )}
          </View>
        </View>
      </View>
    </View>
  );
};

const TimelineStatusCard = React.memo(TimelineStatusCardComponent);

export default TimelineStatusCard;

