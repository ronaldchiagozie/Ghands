import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  JOB_TIMELINE,
  JOB_TIMELINE_LAYOUT,
  timelineBadgeForStep,
  timelineConnectorColor,
  timelineDotFill,
  timelineStatusTimestampColor,
  timelineStepPhase,
} from '@/lib/jobTimelineTheme';

export type JobProgressStep = {
  id: string;
  title: string;
  description: string;
  status: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
  dotColor?: string;
  lineColor?: string;
  showPayLogistics?: boolean;
  showRejectVisit?: boolean;
  showPayService?: boolean;
  logisticsCost?: number;
  payAmount?: number;
  acceptedQuotation?: unknown;
};

type JobProgressTimelineProps = {
  steps: JobProgressStep[];
  renderStepActions?: (step: JobProgressStep) => React.ReactNode;
};

function statusLabelForStep(step: JobProgressStep): string | null {
  const raw = step.status?.trim();
  if (!raw) return null;
  if (raw === 'Active') {
    return timelineStepPhase(step) === 'active' ? 'Waiting' : raw;
  }
  return raw;
}

function StepBadge({ step }: { step: JobProgressStep }) {
  const badge = timelineBadgeForStep(step);
  if (!badge) return null;

  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: badge.bg,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: 'Poppins-SemiBold',
          color: badge.text,
        }}
      >
        {badge.label}
      </Text>
    </View>
  );
}

export function JobProgressTimeline({ steps, renderStepActions }: JobProgressTimelineProps) {
  const reducedMotion = useReducedMotion();
  const rowAnims = useRef<Animated.Value[]>([]);
  const railAnims = useRef<Animated.Value[]>([]);

  if (rowAnims.current.length !== steps.length) {
    rowAnims.current = steps.map(() => new Animated.Value(1));
    railAnims.current = steps.map(() => new Animated.Value(1));
  }

  useEffect(() => {
    if (steps.length === 0) return;

    rowAnims.current.forEach((anim) => anim.setValue(1));
    railAnims.current.forEach((anim) => anim.setValue(1));

    if (reducedMotion) return;

    rowAnims.current.forEach((anim) => anim.setValue(0));
    railAnims.current.forEach((anim) => anim.setValue(0));

    const rowSequence = rowAnims.current.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 200,
          delay: index * 50,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const railSequence = railAnims.current.slice(0, Math.max(0, steps.length - 1)).map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        delay: index * 50 + 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.parallel([...rowSequence, ...railSequence]).start();
  }, [steps.length, reducedMotion]);

  const layout = useMemo(() => JOB_TIMELINE_LAYOUT, []);

  if (steps.length === 0) return null;

  return (
    <View
      style={{
        paddingHorizontal: layout.sectionPaddingH,
        paddingVertical: layout.sectionPaddingV,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Poppins-SemiBold',
          color: JOB_TIMELINE.progressLabel,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 10,
        }}
      >
        PROGRESS
      </Text>

      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const phase = timelineStepPhase(step);
        const IconComponent = step.icon;
        const dotFill = timelineDotFill(step);
        const connectorColor = timelineConnectorColor(step);
        const inlineAction = renderStepActions?.(step);
        const statusLabel = statusLabelForStep(step);
        const rowAnim = rowAnims.current[index] ?? new Animated.Value(1);
        const railAnim = railAnims.current[index] ?? new Animated.Value(1);

        const isPendingDot = phase === 'pending';
        const iconColor =
          phase === 'pending' ? JOB_TIMELINE.iconMuted : '#FFFFFF';
        const iconSize = isPendingDot ? layout.dotIconPending : layout.dotIconActive;

        return (
          <Animated.View
            key={step.id}
            style={{
              flexDirection: 'row',
              marginBottom: isLast ? 0 : layout.rowMarginBottom,
              transform: [
                {
                  translateX: rowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: reducedMotion ? [0, 0] : [-20, 0],
                  }),
                },
              ],
            }}
          >
            <View style={{ alignItems: 'center', marginRight: 10 }}>
              <Animated.View
                style={{
                  width: layout.dotSize,
                  height: layout.dotSize,
                  borderRadius: layout.dotRadius,
                  backgroundColor: dotFill,
                  borderWidth: isPendingDot ? 2 : 0,
                  borderColor: isPendingDot ? JOB_TIMELINE.pendingDotBorder : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    {
                      scale: rowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: reducedMotion ? [1, 1] : [0.8, 1],
                      }),
                    },
                  ],
                }}
              >
                <IconComponent size={iconSize} color={iconColor} />
              </Animated.View>
              {!isLast ? (
                <Animated.View
                  style={{
                    width: layout.connectorWidth,
                    flex: 1,
                    minHeight: layout.connectorMinHeight,
                    marginTop: layout.connectorMarginTop,
                    borderRadius: 1,
                    backgroundColor: connectorColor,
                    transform: [
                      {
                        scaleY: railAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: reducedMotion ? [1, 1] : [0, 1],
                        }),
                      },
                    ],
                  }}
                />
              ) : null}
            </View>

            <View
              style={{
                flex: 1,
                paddingVertical: 2,
                paddingBottom: isLast ? 0 : 8,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: JOB_TIMELINE.panelDivider,
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
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: 'Poppins-SemiBold',
                    color: JOB_TIMELINE.titleText,
                    lineHeight: 18,
                    marginRight: 8,
                  }}
                  numberOfLines={2}
                >
                  {step.title}
                </Text>
                <StepBadge step={step} />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: JOB_TIMELINE.metaText,
                    lineHeight: 17,
                    marginRight: 12,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {step.description}
                </Text>
                {inlineAction ? <View style={{ flexShrink: 0 }}>{inlineAction}</View> : null}
              </View>

              {statusLabel ? (
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontFamily: 'Poppins-Medium',
                    lineHeight: 16,
                    color: timelineStatusTimestampColor(step),
                  }}
                  numberOfLines={1}
                >
                  {statusLabel}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
