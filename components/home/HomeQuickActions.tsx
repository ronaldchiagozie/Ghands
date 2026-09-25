import { LinearGradient } from 'expo-linear-gradient';
import { HandHelping, RotateCcw, Siren, Wallet } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BrandPattern, { type BrandPatternVariant } from '@/components/BrandPattern';
import { BorderRadius, Colors } from '@/lib/designSystem';

type QuickActionId = 'wallet' | 'rebook' | 'urgent' | 'handy';

const CARD_WIDTH = 166;
const CARD_HEIGHT = 96;
/** Eight points is the floor between adjacent targets; ten leaves it airier. */
const GAP = 10;

type HomeQuickActionsProps = {
  /** Null while loading, so nothing is shown rather than a wrong number. */
  balance?: number | null;
  /** The service from their last finished job, when there is one. */
  lastService?: string | null;
  /** True while the repeat booking is being raised, which needs the server. */
  rebookBusy?: boolean;
  onPress: (id: QuickActionId) => void;
};

/** Never a placeholder amount. Silence beats a number that is not theirs. */
const formatBalance = (balance?: number | null): string =>
  typeof balance === 'number' && Number.isFinite(balance)
    ? `₦${Math.round(balance).toLocaleString('en-NG')}`
    : 'View balance';


type Action = {
  id: QuickActionId;
  Icon: typeof Wallet;
  label: string;
  value: string;
  fill: string;
  /** Its own geometry, so the row reads as a set rather than one card recoloured. */
  pattern: BrandPatternVariant;
  patternOpacity: number;
  patternTile: number;
  disabled?: boolean;
};

/**
 * The things worth reaching in one tap.
 *
 * Rebuilt three times, and the shape of the row is the reason. It began as
 * three identical tiles inside a solid sage panel, which were labels rather
 * than shortcuts - "My Wallet" tells you where a tap goes, which a menu
 * already does, while your balance is the thing you opened the app to find.
 * Every card carries something true about the account now instead of naming a
 * destination.
 *
 * Then three equal cards fitted across the screen, which capped every one of
 * them at a width where a balance could only ever be small. Then one large
 * card with two stacked beside it, which fixed the balance and left the other
 * two as offcuts.
 *
 * The row scrolls now, and that is what resolves it: every card is the same
 * size as the wallet, because nothing has to be sacrificed to fit. It is also
 * what lets Handy be here at all - a fourth thing worth reaching that would
 * never have earned a quarter of a fixed row.
 *
 * Colour separates what they are; the pattern separates which is which. That
 * matters more once they scroll, because a card half off the edge is
 * recognised by its texture long before its label is readable.
 */
export default function HomeQuickActions({
  balance,
  lastService,
  rebookBusy = false,
  onPress,
}: HomeQuickActionsProps) {
  const service = lastService?.trim();

  const actions: Action[] = [
    {
      id: 'wallet',
      Icon: Wallet,
      label: 'Wallet',
      value: formatBalance(balance),
      fill: Colors.accent,
      pattern: 'chevron',
      patternOpacity: 0.16,
      patternTile: 26,
    },
    {
      id: 'urgent',
      Icon: Siren,
      label: 'Urgent',
      /**
       * Says what it covers, before they tap it and pick something it does
       * not. Urgent is only allowed for trades where waiting causes damage,
       * and the end of a booking is the worst place to find that out.
       */
      value: 'Repairs only',
      fill: '#8C2F22',
      /** Scattered dots: the one card that should not look orderly. */
      pattern: 'dots',
      patternOpacity: 0.2,
      patternTile: 22,
    },
    {
      id: 'handy',
      Icon: HandHelping,
      label: 'Ask Handy',
      value: 'Describe the job',
      /** Handy's own teal, so the card belongs to the screen it opens. */
      fill: '#003D4D',
      pattern: 'question',
      patternOpacity: 0.17,
      patternTile: 30,
    },
    /**
     * Last, and only once there is something to book again - shown on
     * somebody's first visit it is an instruction they cannot follow.
     */
    ...(service
      ? [
          {
            id: 'rebook' as const,
            Icon: RotateCcw,
            label: 'Book again',
            /** Raising the booking needs the server, and a cold instance is slow. */
            value: rebookBusy ? 'Setting up' : service,
            fill: '#3A4133',
            pattern: 'diagonal' as const,
            patternOpacity: 0.14,
            patternTile: 20,
            disabled: rebookBusy,
          },
        ]
      : []),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /**
       * Snaps to a card. A row that stops between two cards looks like it was
       * dropped rather than scrolled, and the interval is the card plus its
       * gap so every rest position starts a card at the same left edge.
       */
      snapToInterval={CARD_WIDTH + GAP}
      decelerationRate="fast"
      contentContainerStyle={{ paddingRight: 6 }}
    >
      {actions.map((action, index) => (
        <Pressable
          key={action.id}
          onPress={() => onPress(action.id)}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!action.disabled, busy: !!action.disabled }}
          accessibilityLabel={`${action.label}. ${action.value}`}
          android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            marginRight: index === actions.length - 1 ? 0 : GAP,
            opacity: action.disabled ? 0.6 : 1,
          }}
        >
          {/**
            * Everything visual on this inner View. NativeWind flattens a
            * function style on a Pressable and drops it in silence, which is
            * what stacked AccountSetupCard's rows and stripped a whole screen
            * of its cards.
            */}
          <View
            style={{
              flex: 1,
              backgroundColor: action.fill,
              borderRadius: BorderRadius.default,
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 12,
              /** Holds the pattern inside the corners. */
              overflow: 'hidden',
              justifyContent: 'space-between',
            }}
          >
            <BrandPattern
              variant={action.pattern}
              color={Colors.white}
              opacity={action.patternOpacity}
              tile={action.patternTile}
            />

            {/** Subtle fade so the label/value stay legible over the busy pattern beneath them. */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <action.Icon size={18} color={Colors.white} strokeWidth={2} />

            <View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontFamily: 'Poppins-Medium',
                  color: 'rgba(255, 255, 255, 0.78)',
                  letterSpacing: 0.1,
                }}
              >
                {action.label}
              </Text>
              {/**
                * The value at a size that says it is the point. Every card
                * gets it, not just the wallet - which is the whole reason they
                * are all the same size now.
                */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  fontSize: action.id === 'wallet' ? 16 : 14,
                  lineHeight: 21,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                  letterSpacing: -0.2,
                  marginTop: 1,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {action.value}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export type { QuickActionId };
