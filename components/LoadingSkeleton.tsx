import { SHIMMER_PALETTE, useShimmerAnimation } from '@/hooks/useShimmerAnimation';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { JOB_TIMELINE_LAYOUT } from '@/lib/jobTimelineTheme';
import {
  providerHeaderActionButton,
  providerHomeSurface,
  providerHomeSurfacePadding,
  providerJobDetailsPanel,
  providerListCard,
  providerPanelDivider,
  providerStackGapMd,
} from '@/lib/providerSurfaceStyles';
import { PROVIDER_TAB_GUTTER } from '@/lib/tabletLayout';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, ScrollView, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaWrapper from './SafeAreaWrapper';
import { SageHeroPanel } from './provider/SageHeroPanel';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Frost shimmer for sage hero panels */
  variant?: 'default' | 'sage';
}

function ShimmerOverlay({
  variant,
}: {
  variant: 'default' | 'sage';
  borderRadius?: number;
}) {
  const { translateX, translateY, shimmerWidth, shimmerRotate, shimmerEnabled } = useShimmerAnimation();
  const palette = SHIMMER_PALETTE[variant];

  if (!shimmerEnabled) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '-140%',
        bottom: '-140%',
        width: shimmerWidth,
        transform: [{ translateX }, { translateY }, { rotate: shimmerRotate }],
      }}
    >
      <LinearGradient
        colors={[
          'transparent',
          palette.edge,
          palette.highlight,
          palette.highlight,
          palette.edge,
          'transparent',
        ]}
        locations={[0, 0.28, 0.44, 0.56, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

const Skeleton = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  variant = 'default',
}: SkeletonProps) => {
  const palette = SHIMMER_PALETTE[variant];
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const backgroundColor =
    typeof flatStyle.backgroundColor === 'string' ? flatStyle.backgroundColor : palette.base;

  return (
    <View
      style={[
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius,
          backgroundColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <ShimmerOverlay variant={variant} />
    </View>
  );
};

function SkeletonCardShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          ...providerHomeSurface,
          padding: providerHomeSurfacePadding,
          marginBottom: 12,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const CategoryChipSkeleton = () => (
  <View style={{ width: 98, marginRight: 12 }}>
    <View
      style={{
        borderRadius: 16,
        backgroundColor: Colors.white,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Skeleton width={48} height={48} borderRadius={14} style={{ marginBottom: 8 }} />
      <Skeleton width={56} height={11} borderRadius={5} />
    </View>
  </View>
);

export const CategorySkeleton = () => (
  <View
    style={{
      width: '100%',
      backgroundColor: Colors.white,
      borderRadius: 16,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    }}
  >
    <Skeleton width={72} height={72} borderRadius={12} style={{ marginRight: 16 }} />
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Skeleton width="60%" height={16} borderRadius={8} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
      <Skeleton width="40%" height={11} borderRadius={6} />
    </View>
    <Skeleton
      width={24}
      height={24}
      borderRadius={12}
      style={{ position: 'absolute', right: 8, top: '50%', marginTop: -12 }}
    />
  </View>
);

export const ProfileSkeleton = () => (
  <View className="items-center mb-8">
    <Skeleton width={128} height={128} borderRadius={64} />
    <Skeleton width={120} height={16} borderRadius={8} style={{ marginTop: 12 }} />
  </View>
);

export const QuotationCardSkeleton = () => (
  <SkeletonCardShell>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Skeleton width="82%" height={15} borderRadius={7} style={{ marginBottom: 6 }} />
        <Skeleton width="55%" height={12} borderRadius={6} />
      </View>
      <Skeleton width={88} height={28} borderRadius={12} />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
      <View>
        <Skeleton width={72} height={11} borderRadius={5} style={{ marginBottom: 4 }} />
        <Skeleton width={120} height={18} borderRadius={8} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Skeleton width={36} height={11} borderRadius={5} style={{ marginBottom: 4 }} />
        <Skeleton width={64} height={12} borderRadius={6} />
      </View>
    </View>
    <Skeleton width="100%" height={38} borderRadius={12} style={{ marginTop: 4 }} />
  </SkeletonCardShell>
);

export const QuotationListSkeleton = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <QuotationCardSkeleton key={i} />
    ))}
  </>
);

export const WalletHeroSkeleton = ({ variant = 'client' }: { variant?: 'client' | 'provider' }) => (
  <SageHeroPanel style={{ marginTop: 12, marginBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Skeleton width={128} height={10} borderRadius={4} variant="sage" style={{ marginBottom: 6 }} />
        <Skeleton width={108} height={14} borderRadius={6} variant="sage" />
      </View>
      <Skeleton width={30} height={30} borderRadius={15} variant="sage" />
    </View>
    <Skeleton width="72%" height={30} borderRadius={8} variant="sage" style={{ marginBottom: 12 }} />
    {variant === 'provider' ? (
      <Skeleton width={196} height={34} borderRadius={999} variant="sage" />
    ) : (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.15)',
        }}
      >
        <View style={{ flex: 1 }}>
          <Skeleton width={88} height={10} borderRadius={4} variant="sage" style={{ marginBottom: 6 }} />
          <Skeleton width={36} height={15} borderRadius={6} variant="sage" />
        </View>
        <View
          style={{
            width: 1,
            height: 28,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            marginHorizontal: 14,
          }}
        />
        <View style={{ flex: 1 }}>
          <Skeleton width={72} height={10} borderRadius={4} variant="sage" style={{ marginBottom: 6 }} />
          <Skeleton width={52} height={15} borderRadius={6} variant="sage" />
        </View>
      </View>
    )}
  </SageHeroPanel>
);

export const WalletActionButtonsSkeleton = () => (
  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
    <Skeleton height={40} borderRadius={BorderRadius.default} style={{ flex: 1 }} />
    <Skeleton height={40} borderRadius={BorderRadius.default} style={{ flex: 1 }} />
  </View>
);

export const WalletActivitySkeleton = ({ count = 3 }: { count?: number }) => (
  <>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <Skeleton width={120} height={16} borderRadius={8} />
      <Skeleton width={72} height={13} borderRadius={6} />
    </View>
    {Array.from({ length: count }).map((_, i) => (
      <TransactionCardSkeleton key={i} />
    ))}
  </>
);

/** Provider home — location row + welcome line */
export const ProviderDashboardHeaderSkeleton = () => (
  <View style={{ marginBottom: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
        <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8 }} />
        <Skeleton width="58%" height={14} borderRadius={7} />
      </View>
      <Skeleton width={38} height={38} borderRadius={19} />
    </View>
    <Skeleton width="64%" height={22} borderRadius={8} style={{ marginTop: 12 }} />
  </View>
);

/** Provider home — earnings sage card */
export const ProviderEarningsSkeleton = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <SageHeroPanel style={[{ marginHorizontal: PROVIDER_TAB_GUTTER }, style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Skeleton width={168} height={14} borderRadius={6} variant="sage" />
      <Skeleton width={88} height={28} borderRadius={999} variant="sage" />
    </View>
    <Skeleton width="68%" height={30} borderRadius={8} variant="sage" style={{ marginBottom: 12 }} />
    <Skeleton width={148} height={34} borderRadius={999} variant="sage" />
  </SageHeroPanel>
);

/** Provider home — quick action row (matches Add Service / Invite Friends) */
export const ProviderQuickActionsSkeleton = () => (
  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
    <Skeleton height={40} borderRadius={BorderRadius.default} style={{ flex: 1 }} />
    <Skeleton height={40} borderRadius={BorderRadius.default} style={{ flex: 1 }} />
  </View>
);

/** Provider home — job cards only (section titles stay real) */
export const ProviderJobListSkeleton = ({ count = 2 }: { count?: number }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <JobCardSkeleton key={i} />
    ))}
  </View>
);

export const TransactionCardSkeleton = () => (
  <SkeletonCardShell>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="70%" height={14} borderRadius={7} style={{ marginBottom: 6 }} />
        <Skeleton width="90%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
        <Skeleton width="50%" height={11} borderRadius={6} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Skeleton width={60} height={16} borderRadius={8} style={{ marginBottom: 4 }} />
        <Skeleton width={40} height={12} borderRadius={6} />
      </View>
    </View>
    <Skeleton width="100%" height={38} borderRadius={12} style={{ marginTop: 10 }} />
  </SkeletonCardShell>
);

/** Inline amount + trend placeholders inside an existing sage panel */
export const SageAmountSkeleton = () => (
  <View>
    <Skeleton width="72%" height={28} borderRadius={8} variant="sage" style={{ marginBottom: 10 }} />
    <Skeleton width={148} height={32} borderRadius={999} variant="sage" />
  </View>
);

/** Compact job card — fewer blocks, cleaner silhouette */
export const JobCardSkeleton = () => (
  <SkeletonCardShell style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="62%" height={14} borderRadius={7} style={{ marginBottom: 5 }} />
        <Skeleton width="42%" height={12} borderRadius={6} />
      </View>
    </View>
    <Skeleton width="78%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
    <Skeleton width="54%" height={12} borderRadius={6} style={{ marginBottom: 12 }} />
    <Skeleton width="100%" height={36} borderRadius={12} />
  </SkeletonCardShell>
);

export const JobHistoryCardSkeleton = () => (
  <SkeletonCardShell style={{ position: 'relative' }}>
    <Skeleton width={80} height={12} borderRadius={6} style={{ marginBottom: 8 }} />
    <Skeleton width={90} height={24} borderRadius={12} style={{ marginBottom: 12, alignSelf: 'flex-start' }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingRight: 50 }}>
      <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={16} borderRadius={8} style={{ marginBottom: 4 }} />
        <Skeleton width="80%" height={14} borderRadius={7} />
      </View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Skeleton width={12} height={12} borderRadius={6} style={{ marginRight: 8 }} />
      <Skeleton width="50%" height={14} borderRadius={7} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Skeleton width={12} height={12} borderRadius={6} style={{ marginRight: 8 }} />
      <Skeleton width="70%" height={14} borderRadius={7} />
    </View>
    <Skeleton width="100%" height={38} borderRadius={12} />
    <View style={{ position: 'absolute', right: 14, top: 52, flexDirection: 'row', gap: 4 }}>
      <Skeleton width={40} height={40} borderRadius={8} />
      <Skeleton width={40} height={40} borderRadius={8} />
      <Skeleton width={40} height={40} borderRadius={8} />
    </View>
  </SkeletonCardShell>
);

export const NotificationCardSkeleton = () => (
  <View
    style={{
      flexDirection: 'row',
      marginBottom: 10,
      ...providerListCard,
      paddingVertical: 12,
      paddingHorizontal: 12,
      minHeight: 96,
      alignItems: 'flex-start',
    }}
  >
    <Skeleton width={36} height={36} borderRadius={14} style={{ marginRight: 10 }} />
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Skeleton width="58%" height={13} borderRadius={6} style={{ flex: 1, maxWidth: '75%' }} />
        <Skeleton width={8} height={8} borderRadius={4} style={{ marginLeft: 8 }} />
      </View>
      <Skeleton width="100%" height={12} borderRadius={6} style={{ marginBottom: 5 }} />
      <Skeleton width="88%" height={12} borderRadius={6} style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Skeleton width={92} height={26} borderRadius={999} />
        <Skeleton width={72} height={26} borderRadius={999} />
      </View>
    </View>
  </View>
);

/** Fills notifications list while loading — matches real card height and count for viewport. */
export const NotificationsListSkeleton = () => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardBlockHeight = 106;
  const reservedTop = insets.top + 200;
  const reservedBottom = insets.bottom + 100;
  const listHeight = Math.max(320, windowHeight - reservedTop - reservedBottom);
  const count = Math.min(14, Math.max(7, Math.ceil(listHeight / cardBlockHeight)));

  return (
    <View style={{ minHeight: listHeight, paddingBottom: 8 }}>
      <Skeleton width={72} height={12} borderRadius={6} style={{ marginBottom: 12 }} />
      {Array.from({ length: count }).map((_, i) => (
        <NotificationCardSkeleton key={`notifications-skeleton-${i}`} />
      ))}
    </View>
  );
};

/** Timeline rail — matches JobProgressTimeline (26px dots, PROGRESS section). */
export const JobDetailsTimelineSkeleton = ({
  steps = 6,
  fillRemaining = false,
}: {
  steps?: number;
  fillRemaining?: boolean;
}) => {
  const layout = JOB_TIMELINE_LAYOUT;

  return (
    <View
      style={{
        paddingHorizontal: layout.sectionPaddingH,
        paddingVertical: layout.sectionPaddingV,
        flex: fillRemaining ? 1 : undefined,
        flexGrow: fillRemaining ? 1 : undefined,
      }}
    >
      <Skeleton width={72} height={12} borderRadius={6} style={{ marginBottom: 10 }} />
      {Array.from({ length: steps }).map((_, i) => {
        const isLast = i === steps - 1;
        return (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              marginBottom: isLast ? 0 : layout.rowMarginBottom,
              flexGrow: fillRemaining && isLast ? 1 : undefined,
            }}
          >
            <View style={{ alignItems: 'center', marginRight: 10 }}>
              <Skeleton
                width={layout.dotSize}
                height={layout.dotSize}
                borderRadius={layout.dotRadius}
              />
              {!isLast ? (
                fillRemaining ? (
                  <View
                    style={{
                      width: layout.connectorWidth,
                      flex: 1,
                      minHeight: layout.connectorMinHeight,
                      marginTop: layout.connectorMarginTop,
                      alignItems: 'center',
                    }}
                  >
                    <Skeleton width={layout.connectorWidth} borderRadius={1} style={{ flex: 1 }} />
                  </View>
                ) : (
                  <Skeleton
                    width={layout.connectorWidth}
                    height={layout.connectorMinHeight}
                    borderRadius={1}
                    style={{ marginTop: layout.connectorMarginTop }}
                  />
                )
              ) : null}
            </View>
            <View
              style={{
                flex: 1,
                paddingVertical: 2,
                paddingBottom: isLast ? 0 : 8,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: '#E5E7EB',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Skeleton width="52%" height={13} borderRadius={7} style={{ flex: 1, marginRight: 8 }} />
                <Skeleton width={44} height={18} borderRadius={6} />
              </View>
              <Skeleton width="88%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
              <Skeleton width="72%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
              <Skeleton width="38%" height={11} borderRadius={5} />
            </View>
          </View>
        );
      })}
      {fillRemaining ? (
        <View style={{ flex: 1, minHeight: 48, paddingTop: 12, paddingHorizontal: layout.sectionPaddingH }}>
          <Skeleton width="100%" height={12} borderRadius={6} style={{ marginBottom: 10, opacity: 0.55 }} />
          <Skeleton width="76%" height={12} borderRadius={6} style={{ marginBottom: 10, opacity: 0.45 }} />
          <Skeleton width="54%" height={12} borderRadius={6} style={{ opacity: 0.35 }} />
        </View>
      ) : null}
    </View>
  );
};

/** Matches ClientJobUpdatesPanel — provider row, CURRENT STATUS, PROGRESS timeline. */
export const ClientJobUpdatesPanelSkeleton = ({
  fillHeight,
}: {
  fillHeight?: number;
}) => (
  <View
    style={[
      providerJobDetailsPanel,
      fillHeight != null
        ? { flex: 1, height: '100%', minHeight: fillHeight, marginBottom: 0 }
        : null,
    ]}
  >
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: providerHomeSurfacePadding,
        paddingVertical: providerStackGapMd,
      }}
    >
      <Skeleton width={38} height={38} borderRadius={19} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="46%" height={14} borderRadius={7} style={{ marginBottom: 6 }} />
        <Skeleton width="32%" height={11} borderRadius={6} />
      </View>
      <View style={[providerHeaderActionButton, { marginLeft: 6, backgroundColor: '#F3F4F6' }]}>
        <Skeleton width={16} height={16} borderRadius={8} />
      </View>
      <View style={[providerHeaderActionButton, { marginLeft: 6, backgroundColor: '#F3F4F6' }]}>
        <Skeleton width={16} height={16} borderRadius={8} />
      </View>
    </View>

    <View style={providerPanelDivider} />

    <View
      style={{
        paddingHorizontal: providerHomeSurfacePadding,
        paddingVertical: providerStackGapMd,
      }}
    >
      <Skeleton width={96} height={10} borderRadius={5} style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Skeleton width="78%" height={15} borderRadius={7} style={{ marginBottom: 8 }} />
          <Skeleton width="92%" height={12} borderRadius={6} />
        </View>
        <Skeleton width={18} height={18} borderRadius={9} />
      </View>
    </View>

    <View style={providerPanelDivider} />

    <View style={{ flex: 1 }}>
      <JobDetailsTimelineSkeleton steps={6} fillRemaining={fillHeight != null} />
    </View>
  </View>
);

/** Provider Updates tab — client row, status pill, timeline (matches ProviderJobDetailsScreen). */
export const ProviderJobUpdatesTabSkeleton = () => (
  <ClientJobUpdatesPanelSkeleton />
);

/** Scroll body — unified updates panel (client job details Updates tab) */
export const JobDetailsContentSkeleton = ({
  areaHeight,
}: {
  areaHeight?: number;
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fallbackHeight = Math.max(520, windowHeight - insets.top - insets.bottom - 168);
  const fillHeight = areaHeight && areaHeight > 0 ? areaHeight : fallbackHeight;

  return (
    <View style={{ height: fillHeight, minHeight: fillHeight }}>
      <ClientJobUpdatesPanelSkeleton fillHeight={fillHeight} />
    </View>
  );
};

/** Quotations tab — banner, quote card, breakdown, findings, sticky footer (client job details). */
export const JobDetailsQuotationsTabSkeleton = ({
  areaHeight,
}: {
  areaHeight?: number;
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fallbackHeight = Math.max(520, windowHeight - insets.top - insets.bottom - 168);
  const fillHeight = areaHeight && areaHeight > 0 ? areaHeight : fallbackHeight;

  return (
    <View style={{ flex: 1, minHeight: fillHeight }}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 13,
            marginBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 0.6,
            borderColor: 'rgba(17, 24, 39, 0.04)',
          }}
        >
          <Skeleton width={30} height={30} borderRadius={15} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="58%" height={13} borderRadius={7} style={{ marginBottom: 6 }} />
            <Skeleton width="88%" height={11} borderRadius={6} />
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#E3F4DF',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 16,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Skeleton width={56} height={56} borderRadius={28} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width="62%" height={16} borderRadius={8} style={{ marginBottom: 6 }} />
              <Skeleton width="48%" height={12} borderRadius={6} />
            </View>
            <Skeleton width={72} height={24} borderRadius={8} />
          </View>
        </View>

        <Skeleton width="52%" height={16} borderRadius={8} style={{ marginBottom: 12 }} />
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#F3F4F6',
            paddingHorizontal: 16,
            paddingVertical: 16,
            marginBottom: 16,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: i < 3 ? 12 : 0,
                paddingBottom: i < 3 ? 12 : 0,
                borderBottomWidth: i < 3 ? 1 : 0,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <Skeleton width={`${48 + i * 8}%` as `${number}%`} height={13} borderRadius={6} />
              <Skeleton width={64} height={13} borderRadius={6} />
            </View>
          ))}
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Skeleton width={48} height={16} borderRadius={8} />
            <Skeleton width={88} height={18} borderRadius={8} />
          </View>
        </View>

        <Skeleton width="64%" height={16} borderRadius={8} style={{ marginBottom: 12 }} />
        <View
          style={{
            backgroundColor: Colors.white,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#F3F4F6',
            paddingHorizontal: 16,
            paddingVertical: 16,
            marginBottom: 16,
          }}
        >
          <Skeleton width="100%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="92%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="76%" height={12} borderRadius={6} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Skeleton width={72} height={14} borderRadius={7} />
          <Skeleton width={36} height={14} borderRadius={7} />
          <Skeleton width={56} height={14} borderRadius={7} />
        </View>
      </View>

      <View
        style={{
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
        }}
      >
        <Skeleton width="100%" height={52} borderRadius={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={52} borderRadius={12} />
      </View>
    </View>
  );
};

export const JobDetailsTabsSkeleton = () => (
  <View
    style={{
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      marginBottom: 16,
    }}
  >
    {[72, 88].map((w, i) => (
      <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
        <Skeleton width={w} height={14} borderRadius={7} />
      </View>
    ))}
  </View>
);

/** Full job details loading shell — header, tabs, scroll content */
export const JobDetailsScreenSkeleton = () => (
  <SafeAreaWrapper backgroundColor={Colors.white}>
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: PROVIDER_TAB_GUTTER,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
        <Skeleton width="44%" height={22} borderRadius={8} />
      </View>

      <View style={{ paddingHorizontal: PROVIDER_TAB_GUTTER }}>
        <JobDetailsTabsSkeleton />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: PROVIDER_TAB_GUTTER,
          paddingBottom: 120,
        }}
      >
        <View style={{ flex: 1, minHeight: 520 }}>
          <ProviderJobUpdatesTabSkeleton />
        </View>
      </ScrollView>
    </View>
  </SafeAreaWrapper>
);

export default Skeleton;
