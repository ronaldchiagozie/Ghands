import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

/**
 * The moment a job is finished.
 *
 * Booking a tradesman is a small act of trust that runs for days - somebody
 * came into your home, did work you cannot easily judge, and you paid for it.
 * The end of that deserves more than a screen quietly changing state, and this
 * is the one place in the app where a flourish is the honest response rather
 * than decoration.
 *
 * Fires once and never loops. A celebration that repeats is not a celebration,
 * it is an animation - and the difference is that this one is over before
 * anybody could tire of it.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Enough to read as a burst, few enough to stay smooth on a mid-range Android.
 * Every piece is its own Animated.Value, so this number is a frame budget as
 * much as a design choice.
 */
const PIECE_COUNT = 34;
const FALL_MS = 2400;

/**
 * The app's greens, plus two warm tones for contrast.
 *
 * Sage alone would be tasteful and invisible against a page that is already
 * sage - confetti has to be seen. The warm pair does the seeing; the greens
 * keep it ours rather than generic party colours.
 */
const COLORS = ['#4F6739', '#6E8F4C', '#A3C47F', '#E4B33C', '#D9714E', '#FFFFFF'];

type Piece = {
  key: string;
  color: string;
  /** Where it starts across the screen, as a fraction. */
  x: number;
  /** Ribbons and squares in the same burst; one shape reads as a texture. */
  width: number;
  height: number;
  delay: number;
  duration: number;
  drift: number;
  spins: number;
  radius: number;
};

function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, index) => {
    const ribbon = index % 3 !== 0;
    return {
      key: `piece-${index}`,
      color: COLORS[index % COLORS.length],
      x: Math.random(),
      width: ribbon ? 6 : 9,
      height: ribbon ? 13 : 9,
      /**
       * Staggered starts. Released together they fall as a single line, which
       * reads as a curtain rather than a burst.
       */
      delay: Math.random() * 420,
      duration: FALL_MS * (0.72 + Math.random() * 0.5),
      /** Sideways travel, either way, so nothing falls straight down. */
      drift: (Math.random() - 0.5) * 160,
      spins: 1 + Math.random() * 3,
      radius: ribbon ? 1.5 : 4.5,
    };
  });
}

type ConfettiProps = {
  /** Flip to true once, at the moment worth marking. */
  visible: boolean;
  /** Told when the last piece lands, so the host can unmount it. */
  onDone?: () => void;
};

function ConfettiPiece({ piece, height }: { piece: Piece; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      /**
       * Linear, not eased. Gravity does not ease out, and a piece that slows as
       * it lands looks like it is being placed rather than falling.
       */
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [piece, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, height + 60],
  });
  /** Drifts out and drifts back, the way something light falling through air does. */
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, piece.drift, piece.drift * 0.4],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spins * 360}deg`],
  });
  /** Fades only at the very end, so it disappears rather than stopping. */
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: piece.x * SCREEN_WIDTH,
        top: 0,
        width: piece.width,
        height: piece.height,
        borderRadius: piece.radius,
        backgroundColor: piece.color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export default function Confetti({ visible, onDone }: ConfettiProps) {
  const reducedMotion = useReducedMotion();
  const { height } = Dimensions.get('window');
  /** Built once. Rebuilding would reshuffle every piece mid-fall. */
  const pieces = useMemo(() => buildPieces(), []);

  useEffect(() => {
    if (!visible || reducedMotion) return;
    const longest = Math.max(...pieces.map((piece) => piece.delay + piece.duration));
    const timer = setTimeout(() => onDone?.(), longest + 120);
    return () => clearTimeout(timer);
  }, [visible, reducedMotion, pieces, onDone]);

  /**
   * Nothing at all when motion is reduced. There is no still version of
   * confetti worth showing - a frozen scatter of shapes over a screen is
   * clutter, and the words underneath already say the job is done.
   */
  if (!visible || reducedMotion) return null;

  return (
    /** Deaf to touch: this covers the screen, including whatever button is next. */
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => (
        <ConfettiPiece key={piece.key} piece={piece} height={height} />
      ))}
    </View>
  );
}
