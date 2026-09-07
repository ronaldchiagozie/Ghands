import { RotateCcw, Siren, Wallet } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';

type QuickActionId = 'wallet' | 'rebook' | 'urgent';

type HomeQuickActionsProps = {
  /** Null while loading, so nothing is shown rather than a wrong number. */
  balance?: number | null;
  /** The service from their most recent job, when there is one. */
  lastService?: string | null;
  onPress: (id: QuickActionId) => void;
};

/**
 * The three things worth reaching in one tap.
 *
 * Rebuilt from three identical tiles inside a solid sage panel. Four things
 * were wrong with it.
 *
 * They were labels, not shortcuts. "My Wallet" tells you where a tap goes,
 * which a menu already does. Your balance is the thing you opened the app to
 * find, and it fits in the same space. Every card here carries something true
 * about your account rather than naming a destination.
 *
 * They pretended to be equal. Urgent is rare and high-stakes, the wallet is
 * frequent and informational, rebooking only means anything once you have
 * booked before. Three matching tiles say those are the same kind of thing.
 *
 * There were five colours in a row three hundred pixels wide: red, green and
 * amber circles, each with a white ring, on a sage field. Colour lives on the
 * type now, so urgent can be the exception without the row shouting.
 *
 * And it had a caption explaining what quick actions are, which is the tell
 * that the tiles were not explaining themselves.
 */
export default function HomeQuickActions({
  balance,
  lastService,
  onPress,
}: HomeQuickActionsProps) {
  const service = lastService?.trim();

  /**
   * Rebooking is hidden until there is something to rebook. Shown to somebody
   * on their first visit it is an instruction they cannot follow.
   */
  const actions: {
    id: QuickActionId;
    Icon: typeof Wallet;
    label: string;
    value: string;
    tone: string;
  }[] = [
    {
      id: 'wallet',
      Icon: Wallet,
      label: 'Wallet',
      /** Never a placeholder amount. Silence beats a number that is not theirs. */
      value:
        typeof balance === 'number' && Number.isFinite(balance)
          ? `₦${Math.round(balance).toLocaleString('en-NG')}`
          : 'View balance',
      tone: Colors.accent,
    },
    ...(service
      ? [
          {
            id: 'rebook' as const,
            Icon: RotateCcw,
            label: 'Book again',
            value: service,
            tone: Colors.accent,
          },
        ]
      : []),
    {
      id: 'urgent',
      Icon: Siren,
      label: 'Urgent',
      /**
       * Says what it covers, before they tap it and pick something it does not.
       * Urgent is only allowed for trades where waiting causes damage, and
       * finding that out at the end of a booking is the worst place to learn it.
       */
      value: 'Repairs only',
      tone: Colors.error,
    },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onPress(action.id)}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}. ${action.value}`}
          android_ripple={{ color: 'rgba(17, 24, 39, 0.06)' }}
          style={{ flex: 1 }}
        >
          {/**
            * Everything visual on this inner View. NativeWind wraps every
            * element here and flattens a function style on a Pressable, which
            * is what stacked AccountSetupCard's rows and stripped the alert
            * buttons of their backgrounds.
            */}
          <View
            style={{
              ...SURFACE_STYLES.homeCard,
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.lg,
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: 11,
            }}
          >
            <action.Icon size={19} color={action.tone} strokeWidth={2.1} />

            {/**
              * Left-aligned, not centred. A centred label in a small box reads
              * as a button; a label with a value beneath it reads as something
              * you already know, which is what these are.
              */}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12.5,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
                letterSpacing: -0.1,
                marginTop: 10,
              }}
            >
              {action.label}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                fontSize: 11.5,
                lineHeight: 16,
                fontFamily: 'Poppins-Medium',
                color: action.id === 'urgent' ? Colors.error : Colors.textSecondaryDark,
                marginTop: 1,
                /** Digits line up across the row when the balance is showing. */
                fontVariant: ['tabular-nums'],
              }}
            >
              {action.value}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export type { QuickActionId };
