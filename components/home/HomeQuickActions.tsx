import { RotateCcw, Siren, Wallet } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';

type QuickActionId = 'wallet' | 'rebook' | 'urgent';

type HomeQuickActionsProps = {
  /** Null while loading, so nothing is shown rather than a wrong number. */
  balance?: number | null;
  /** The service from their last finished job, when there is one. */
  lastService?: string | null;
  /** True while the repeat booking is being raised, which needs the server. */
  rebookBusy?: boolean;
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
  rebookBusy = false,
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
    busy?: boolean;
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
            /**
             * Raising the booking needs the server, and a cold instance can
             * take several seconds. The card says so in place of the service
             * name rather than sitting there looking ignored.
             */
            value: rebookBusy ? 'Setting up' : service,
            tone: Colors.accent,
            busy: rebookBusy,
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
          disabled={action.busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!action.busy, busy: !!action.busy }}
          accessibilityLabel={`${action.label}. ${action.value}`}
          android_ripple={{ color: 'rgba(17, 24, 39, 0.06)' }}
          style={{ flex: 1, opacity: action.busy ? 0.6 : 1 }}
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
              /**
                * Flat, unlike the cards below. A shadow says a surface is
                * lifted off the page and worth reaching for, which is right
                * for a job card you are being asked to read and wrong for
                * three small shortcuts sitting in a row. Three of them side by
                * side just made the row feel heavy. The hairline border is
                * enough to hold each card's edge.
                */
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
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
