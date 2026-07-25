import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Activity, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react-native';
import { CallIconOutline } from '@/components/call/CallIcons';
import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import { JobProgressTimeline, type JobProgressStep } from '@/components/JobProgressTimeline';
import { haptics } from '@/hooks/useHaptics';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import { logCallDebug } from '@/utils/callDebugLog';
import { makeCall } from '@/utils/callUtils';
import {
  providerHeaderActionButton,
  providerHomeSurfacePadding,
  providerJobDetailsPanel,
  providerPanelDivider,
  providerStackGapMd,
} from '@/lib/providerSurfaceStyles';
import { buildChatScreenParams } from '@/utils/navigation';
import { formatProviderProximitySubtitle } from '@/utils/navigationUtils';

type TimelineHeaderData = {
  title: string;
  subtitle?: string;
  statusPill?: string;
  pillBg?: string;
  pillText?: string;
  timestamp?: string | null;
  provider?: {
    id?: number;
    name?: string;
    phoneNumber?: string;
    profileImageUri?: string | null;
  } | null;
};

type MappedProviderSummary = {
  providerId: number;
  distanceKm?: number;
  minutesAway?: number;
};

type ClientIdentity = {
  displayName?: string;
  imageUri?: string | null;
};

type ClientJobUpdatesPanelProps = {
  header: TimelineHeaderData | null;
  steps: JobProgressStep[];
  mappedProviders: MappedProviderSummary[];
  requestId?: string | string[];
  clientIdentity?: ClientIdentity | null;
  showSyncHint?: boolean;
  renderStepActions?: (step: JobProgressStep) => React.ReactNode;
};

function PanelDivider() {
  return <View style={providerPanelDivider} />;
}

export function ClientJobUpdatesPanel({
  header,
  steps,
  mappedProviders,
  requestId,
  clientIdentity,
  showSyncHint,
  renderStepActions,
}: ClientJobUpdatesPanelProps) {
  const router = useRouter();
  const [statusExpanded, setStatusExpanded] = useState(() => Boolean(header?.subtitle));

  const provider = header?.provider;
  const rawProviderName = String(provider?.name || '').trim();
  const providerName =
    !rawProviderName || rawProviderName.toLowerCase() === 'professional service provider'
      ? 'Provider'
      : rawProviderName;

  const providerSummary =
    provider &&
    (mappedProviders.find((m) => m.providerId === provider.id) ?? mappedProviders[0]);

  const proximityLine = providerSummary
    ? formatProviderProximitySubtitle(providerSummary.distanceKm, providerSummary.minutesAway)
    : null;

  const normalizedRequestId = typeof requestId === 'string' ? requestId : requestId?.[0];

  const handlePressProvider = () => {
    if (!provider?.id) return;
    haptics.light();
    router.push({
      pathname: '/ProviderDetailScreen',
      params: {
        providerName: provider.name,
        providerId: provider.id.toString(),
      },
    } as any);
  };

  const handlePressChat = () => {
    if (!provider || !normalizedRequestId) return;
    haptics.light();
    router.push({
      pathname: '/ChatScreen',
      params: buildChatScreenParams({
        providerName: provider.name,
        providerId: provider.id?.toString(),
        requestId: normalizedRequestId,
        fromJobHub: true,
      }),
    } as any);
  };

  const handlePressCall = () => {
    if (!provider || !normalizedRequestId) return;
    haptics.light();
    logCallDebug('ClientJobUpdatesPanel: open CallScreen (outgoing)', {
      requestId: normalizedRequestId,
      providerId: provider.id,
      providerName,
    });
    makeCall(
      providerName,
      provider.id?.toString(),
      {
        title: 'Service Request',
        description: 'Ongoing service request',
        requestId: normalizedRequestId,
        status: 'In Progress',
      },
      false,
    );
  };

  const showStatusAccordion = Boolean(header?.title);

  return (
    <>
      {showSyncHint ? (
        <View
          style={{
            backgroundColor: '#E0F2FE',
            borderWidth: 1,
            borderColor: '#BAE6FD',
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Activity size={18} color="#0284C7" style={{ marginRight: 10 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: '#0C4A6E',
              lineHeight: 18,
            }}
          >
            If you&apos;ve paid, pull down to refresh for the latest status.
          </Text>
        </View>
      ) : null}

      <View style={providerJobDetailsPanel}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: providerHomeSurfacePadding,
            paddingVertical: providerStackGapMd,
          }}
        >
          {provider ? (
            <>
              <TouchableOpacity activeOpacity={0.7} onPress={handlePressProvider} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('../../assets/images/plumbericon2.png')}
                  style={{ width: 38, height: 38, borderRadius: 19, marginRight: 10 }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: JOB_TIMELINE.titleText }}
                    numberOfLines={1}
                  >
                    {providerName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-Regular',
                      color: JOB_TIMELINE.roleText,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {proximityLine ?? 'Provider'}
                  </Text>
                </View>
              </TouchableOpacity>
              {normalizedRequestId ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePressCall}
                  style={[providerHeaderActionButton, { marginLeft: 6 }]}
                >
                  <CallIconOutline size={16} color={JOB_TIMELINE.sage} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePressChat}
                style={[providerHeaderActionButton, { marginLeft: 6 }]}
              >
                <MessageCircle size={16} color={JOB_TIMELINE.sage} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  marginRight: 10,
                  overflow: 'hidden',
                  backgroundColor: JOB_TIMELINE.pendingDotFill,
                  borderWidth: 1,
                  borderColor: JOB_TIMELINE.panelBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {clientIdentity?.imageUri ? (
                  <Image
                    source={{ uri: clientIdentity.imageUri }}
                    style={{ width: 38, height: 38 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={20} color={JOB_TIMELINE.iconMuted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: JOB_TIMELINE.titleText }}
                  numberOfLines={1}
                >
                  {clientIdentity?.displayName?.trim() || 'You'}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: 'Poppins-Regular',
                    color: JOB_TIMELINE.roleText,
                    marginTop: 1,
                  }}
                >
                  Your request
                </Text>
              </View>
            </View>
          )}
        </View>

        {showStatusAccordion ? (
          <>
            <PanelDivider />
            <View
              style={{
                paddingHorizontal: providerHomeSurfacePadding,
                paddingVertical: providerStackGapMd,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  haptics.selection();
                  setStatusExpanded((current) => !current);
                }}
                style={{ flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: 'Poppins-SemiBold',
                        color: JOB_TIMELINE.roleText,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      CURRENT STATUS
                    </Text>
                    {header?.statusPill ? (
                      <View
                        style={{
                          backgroundColor: header.pillBg ?? JOB_TIMELINE.pendingSoft,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 20,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: 'Poppins-SemiBold',
                            color: header.pillText ?? JOB_TIMELINE.pendingChipText,
                          }}
                        >
                          {header.statusPill}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-SemiBold',
                      color:
                        header?.statusPill === 'Declined'
                          ? JOB_TIMELINE.declinedChipText
                          : JOB_TIMELINE.titleText,
                      lineHeight: 20,
                    }}
                    numberOfLines={statusExpanded ? 2 : 2}
                  >
                    {header?.title}
                  </Text>
                  {statusExpanded && header?.subtitle ? (
                    <Text
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        fontFamily: 'Poppins-Regular',
                        color: JOB_TIMELINE.metaText,
                        lineHeight: 18,
                      }}
                    >
                      {header.subtitle}
                    </Text>
                  ) : null}
                  {statusExpanded && header?.timestamp ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                      <Ionicons name="time-outline" size={14} color={JOB_TIMELINE.iconMuted} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Poppins-Regular',
                          color: JOB_TIMELINE.titleText,
                        }}
                      >
                        {header.timestamp}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {statusExpanded ? (
                  <ChevronUp size={18} color={JOB_TIMELINE.iconMuted} />
                ) : (
                  <ChevronDown size={18} color={JOB_TIMELINE.iconMuted} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <PanelDivider />

        <JobProgressTimeline steps={steps} renderStepActions={renderStepActions} />
      </View>
    </>
  );
}
