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
 *
 * One card is filled sage, and only one. A row of three identical white cards
 * on a white page has nothing to look at and nothing to look at first, but
 * colouring all of them brings back the noise that was the original problem.
 * One filled card gives the row an anchor and leaves the other two quiet.
 *
 * The wallet gets it because it is the one that always has something to say.
 * Rebook is not always there and urgent is rare, so filling either would put
 * the weight on the card least likely to matter today.
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
    /** Exactly one card carries the sage. See the note on the row below. */
    filled?: boolean;
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
      tone: Colors.white,
      filled: true,
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
              backgroundColor: action.filled ? Colors.accent : Colors.white,
              /** Same weight of edge on all three, so only the fill differs. */
              borderColor: action.filled ? 'rgba(30, 45, 18, 0.45)' : SURFACE_STYLES.homeCard.borderColor,
              borderRadius: BorderRadius.default,
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
                color: action.filled ? Colors.white : Colors.textPrimary,
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
                color: action.filled
                  ? 'rgba(255, 255, 255, 0.82)'
                  : action.id === 'urgent'
                    ? Colors.error
                    : Colors.textSecondaryDark,
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
