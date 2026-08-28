import { ChevronRight, CreditCard, MapPin, ShieldCheck, Sparkles, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';
import type { SetupTask, SetupTaskId } from '@/hooks/useAccountSetup';

const TASK_ICON: Record<SetupTaskId, typeof User> = {
  profile: User,
  location: MapPin,
  pin: ShieldCheck,
  bank: CreditCard,
  notifications: Sparkles,
};

type AccountSetupCardProps = {
  outstanding: SetupTask[];
  completedCount: number;
  totalCount: number;
  onTaskPress: (id: SetupTaskId) => void;
};

/**
 * Shows only what is actually left to do, and disappears when nothing is.
 *
 * The row this replaces was a fixed array of three cards shown to everyone
 * forever — someone who finished their profile a month ago still saw "Complete
 * Your Profile". A checklist that never changes stops being read.
 */
export default function AccountSetupCard({
  outstanding,
  completedCount,
  totalCount,
  onTaskPress,
}: AccountSetupCardProps) {
  if (outstanding.length === 0) return null;

  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const required = outstanding.filter((t) => t.required).length;

  return (
    <View
      style={{
        ...SURFACE_STYLES.homeCard,
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xs,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
      }}
    >
      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              letterSpacing: -0.2,
            }}
          >
            Finish setting up
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              fontVariant: ['tabular-nums'],
            }}
          >
            {completedCount} of {totalCount}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
            marginTop: 3,
          }}
        >
          {required > 0
            ? 'A couple of things are needed before you can book.'
            : 'Optional, but they make everything smoother.'}
        </Text>

        {/* Progress rail */}
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: Colors.backgroundGray,
            marginTop: Spacing.md,
            overflow: 'hidden',
          }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: totalCount, now: completedCount }}
        >
          <View
            style={{
              width: `${Math.max(progress * 100, 4)}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: Colors.accent,
            }}
          />
        </View>
      </View>

      {outstanding.map((task, index) => {
        const Icon = TASK_ICON[task.id];
        const isLast = index === outstanding.length - 1;

        return (
          <Pressable
            key={task.id}
            onPress={() => onTaskPress(task.id)}
            accessibilityRole="button"
            accessibilityLabel={`${task.title}. ${task.detail}`}
            android_ripple={{ color: Colors.backgroundGray }}
            style={{
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              marginBottom: isLast ? Spacing.xs : 0,
            }}
          >
            {/**
             * Row layout lives on this inner View, not on the Pressable. A
             * function style on a Pressable is flattened by the NativeWind JSX
             * wrapper before it reaches the native view, which dropped
             * flexDirection and stacked the icon, text and chevron vertically.
             */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: Spacing.lg,
                paddingVertical: 13,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: task.required ? Colors.successLight : Colors.backgroundGray,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 13,
                }}
              >
                <Icon
                  size={17}
                  color={task.required ? Colors.accent : Colors.textSecondaryDark}
                  strokeWidth={2}
                />
              </View>

              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                  {task.required ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 5,
                        backgroundColor: Colors.successLight,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontFamily: 'Poppins-SemiBold',
                          color: Colors.accent,
                          letterSpacing: 0.3,
                        }}
                      >
                        NEEDED
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 17,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {task.detail}
                </Text>
              </View>

              <ChevronRight size={18} color={Colors.textTertiary} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
