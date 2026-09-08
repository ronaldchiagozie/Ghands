import { RotateCcw, Siren, Wallet } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import BrandPattern from '@/components/BrandPattern';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';

type QuickActionId = 'wallet' | 'rebook' | 'urgent';

/**
 * Tall enough to hold a real number and still breathe.
 *
 * Three equal boxes across a phone left about eighty points of content each,
 * which is enough for a word and not enough for a balance at a size anybody
 * would call designed.
 */
const ROW_HEIGHT = 118;
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

/**
 * A small card in the right-hand column. Urgent and Book again share a shape,
 * because unlike the wallet they really are the same kind of thing.
 */
function SmallAction({
  Icon,
  label,
  value,
  valueColor,
  iconColor,
  onPress,
  disabled = false,
}: {
  Icon: typeof Wallet;
  label: string;
  value: string;
  valueColor: string;
  iconColor: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: disabled }}
      accessibilityLabel={`${label}. ${value}`}
      android_ripple={{ color: 'rgba(17, 24, 39, 0.06)' }}
      style={{ flex: 1, opacity: disabled ? 0.6 : 1 }}
    >
      {/**
        * Everything visual on this inner View. NativeWind flattens a function
        * style on a Pressable and drops it in silence, which is what stacked
        * AccountSetupCard's rows and stripped a whole screen of its cards.
        */}
      <View
        style={{
          ...SURFACE_STYLES.homeCard,
          flex: 1,
          backgroundColor: Colors.white,
          borderRadius: BorderRadius.default,
          paddingHorizontal: 13,
          justifyContent: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Icon size={17} color={iconColor} strokeWidth={2.2} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              letterSpacing: -0.1,
            }}
          >
            {label}
          </Text>
        </View>
        {/** Indented to the label, so the icon column stays a column. */}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11.5,
            fontFamily: 'Poppins-Medium',
            color: valueColor,
            marginTop: 3,
            marginLeft: 24,
          }}
        >
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The three things worth reaching in one tap.
 *
 * Rebuilt twice. First from three identical tiles inside a solid sage panel,
 * which were labels rather than shortcuts - "My Wallet" tells you where a tap
 * goes, which a menu already does, while your balance is the thing you opened
 * the app to find and fits in the same space. Every card carries something
 * true about the account now instead of naming a destination.
 *
 * Then from three equal cards, which was the same mistake in a quieter voice.
 * Urgent is rare and high-stakes, the wallet is frequent and informational,
 * and rebooking means nothing until you have booked before - so matching boxes
 * said they were the same kind of thing, and capped all three at a width where
 * a balance could only ever be small.
 *
 * The wallet takes the larger half and the other two stack beside it. The size
 * difference carries the hierarchy, so the row no longer needs colour on every
 * card to establish one: sage sits on the wallet alone, and urgent stays the
 * exception in red without competing for the same job.
 */
export default function HomeQuickActions({
  balance,
  lastService,
  rebookBusy = false,
  onPress,
}: HomeQuickActionsProps) {
  const service = lastService?.trim();

  return (
    <View style={{ flexDirection: 'row', gap: GAP, height: ROW_HEIGHT }}>
      {/**
        * The wallet, filled and patterned.
        *
        * The one surface on this page carrying the brand colour, so it is the
        * one that earns the lattice: a coloured rectangle with nothing in it
        * is paint, and the same rectangle with the brand's own geometry
        * running quietly through it reads as considered.
        */}
      <Pressable
        onPress={() => onPress('wallet')}
        accessibilityRole="button"
        accessibilityLabel={`Wallet. ${formatBalance(balance)}`}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.12)' }}
        style={{ flex: 1.22 }}
      >
        <View
          style={{
            ...SURFACE_STYLES.homeCard,
            flex: 1,
            backgroundColor: Colors.accent,
            borderColor: 'rgba(30, 45, 18, 0.45)',
            borderRadius: BorderRadius.default,
            paddingHorizontal: 15,
            paddingTop: 14,
            paddingBottom: 14,
            /** Keeps the lattice inside the corner radius. */
            overflow: 'hidden',
            justifyContent: 'space-between',
          }}
        >
          <BrandPattern color={Colors.white} opacity={0.16} tile={26} />

          <Wallet size={21} color={Colors.white} strokeWidth={2.1} />

          <View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Medium',
                color: 'rgba(255, 255, 255, 0.78)',
                letterSpacing: 0.1,
              }}
            >
              Wallet
            </Text>
            {/**
              * The balance, at a size that says it is the point. This is what
              * the extra width bought: three equal cards could not hold a
              * naira figure this large without truncating it.
              */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={{
                fontSize: 20,
                lineHeight: 27,
                fontFamily: 'Poppins-Bold',
                color: Colors.white,
                letterSpacing: -0.5,
                marginTop: 1,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatBalance(balance)}
            </Text>
          </View>
        </View>
      </Pressable>

      {/** Urgent first: it is the one that cannot wait. */}
      <View style={{ flex: 1, gap: GAP }}>
        <SmallAction
          Icon={Siren}
          label="Urgent"
          /**
            * Says what it covers, before they tap it and pick something it
            * does not. Urgent is only allowed for trades where waiting causes
            * damage, and the end of a booking is the worst place to find out.
            */
          value="Repairs only"
          valueColor={Colors.error}
          iconColor={Colors.error}
          onPress={() => onPress('urgent')}
        />

        {/**
          * Hidden until there is something to book again - shown on somebody's
          * first visit it is an instruction they cannot follow. With it gone
          * Urgent takes the whole column rather than leaving a hole.
          */}
        {service ? (
          <SmallAction
            Icon={RotateCcw}
            label="Book again"
            /** Raising the booking needs the server, and a cold instance is slow. */
            value={rebookBusy ? 'Setting up' : service}
            valueColor={Colors.textSecondaryDark}
            iconColor={Colors.accent}
            onPress={() => onPress('rebook')}
            disabled={rebookBusy}
          />
        ) : null}
      </View>
    </View>
  );
}

export type { QuickActionId };
